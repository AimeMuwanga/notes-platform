# Notes Platform API Audit

Audit date: 2026-06-11

## Executive Summary

The repository is a two-service Fastify application:

- `auth-service` owns registration, login, JWT creation, and `/me`.
- `notes-service` owns note CRUD.
- PostgreSQL and Redis are started through Docker Compose.
- Root-level Jest projects run service and integration tests against one test database.

The code is not production-ready. Authentication can work in an already prepared or stale
container, but a clean deployment is not reproducible. The current auth database plugin
overrides the hostname in `DATABASE_URL` with `db`, while Compose names the database service
`postgres`. Neither service runs its migration. The Compose initializer creates `notesdb` only
on the first creation of the PostgreSQL volume and does not create tables.

The largest design defect is identity ownership. Registration writes a user to `authdb`, while
the notes schema in `notesdb` has a foreign key to a separate local `users` table. That user is
never copied from auth to notes. The successful Postman note screenshot contains a manually
inserted `notesdb.users` row with a dummy password hash; this manual row is why that request
succeeds. Normal registration cannot satisfy the notes foreign key.

The notes API is also unauthenticated in production. It ignores the JWT, accepts `user_id` from
the caller, and does not include ownership in get/update/delete queries. Any caller can create a
note for another user and read, update, or delete any known note ID.

## Architecture and Request Flow

Current registration flow:

1. `POST /api/auth/register` reaches
   `services/auth-service/src/routes/auth.js:5-16`.
2. `services/auth-service/src/controllers/authController.js:5-20` hashes the password and
   inserts into `authdb.users`.
3. Every database error is incorrectly returned as `409 User already exists`.

Current login flow:

1. `POST /api/auth/login` has no request schema
   (`services/auth-service/src/routes/auth.js:18`).
2. `services/auth-service/src/controllers/authController.js:23-49` selects the user, verifies
   bcrypt, and signs a JWT containing `sub` and `email`.
3. The token has no explicit expiration, issuer, or audience.

Current notes flow:

1. Routes are mounted under `/api` by
   `services/notes-service/src/app.js:27`.
2. No authentication plugin or production auth hook is registered.
3. Create uses `req.body.user_id`; list uses `req.query.user_id`.
4. Get/update/delete query only by note ID.
5. Redis code is unreachable because the Redis plugin is never registered.

## Critical Issues

### C1. Auth database hostname is overwritten

Responsible code: `services/auth-service/src/plugins/db.js:6-9`

Root cause: `pg.Pool` receives both `connectionString` and `host`. The explicit `host` wins.
In production it becomes `DB_HOST || "db"`, but the Compose service is named `postgres`.
A clean/current image therefore attempts to connect to `db`, not the hostname in
`DATABASE_URL`.

Corrected code:

```js
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});
```

Do not mix a full connection string with separate host/user/database fields. Validate that
`DATABASE_URL` exists before constructing the pool.

### C2. Database migrations never run

Responsible sections:

- `docker-compose.yml:20`
- `init.sql:1`
- `services/auth-service/dockerfile:15`
- `services/notes-service/dockerfile:13`

Root cause: Compose mounts an initializer that only runs `CREATE DATABASE notesdb;`. PostgreSQL
entrypoint scripts run only when `pgdata` is empty. No command applies either service's
`migrations/001_init.sql`. A new database therefore has no application tables, and adding or
changing `init.sql` does nothing to an existing volume.

Corrective approach:

```yaml
auth-migrate:
  build: ./services/auth-service
  command: ["npm", "run", "migrate"]
  environment:
    DATABASE_URL: postgres://postgres:postgres@postgres:5432/authdb
  depends_on:
    postgres:
      condition: service_healthy

notes-migrate:
  build: ./services/notes-service
  command: ["npm", "run", "migrate"]
  environment:
    DATABASE_URL: postgres://postgres:postgres@postgres:5432/notesdb
  depends_on:
    postgres:
      condition: service_healthy
```

The APIs should depend on successful migration jobs. For a real deployment, use a migration
tool with a version table instead of invoking raw `psql`.

### C3. Auth users and notes users are different records in different databases

Responsible sections:

- Auth inserts into `authdb.users`:
  `services/auth-service/src/controllers/authController.js:10-15`
- Notes references `notesdb.users`:
  `services/notes-service/migrations/001_init.sql:4-13`
- Compose points the services at different databases:
  `docker-compose.yml:37,50`

Root cause: PostgreSQL foreign keys cannot reference a table in another database. Registering a
user in `authdb` does not create a `notesdb.users` row. The screenshot showing a successful note
also shows a manually inserted `notesdb.users` row, proving the workaround.

Corrected notes migration:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_user_created
  ON notes (user_id, created_at DESC);
```

The notes service should store the immutable auth user UUID as data, not maintain a duplicate
password-bearing users table. If strict user-existence checks are required, validate via an auth
service endpoint or consume reliable user lifecycle events; do not copy password hashes.

### C4. Notes routes are not protected

Responsible code:

- Test-only user injection: `services/notes-service/src/app.js:12-19`
- No production JWT plugin: `services/notes-service/src/app.js:21-28`
- Unused `AUTH_SERVICE_URL`: `docker-compose.yml:52`

Root cause: no middleware validates `Authorization: Bearer <token>`. The `x-mock-user-id` hook
only runs in tests, and controllers do not require even that mock user.

Corrected notes auth plugin:

```js
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';

async function authPlugin(fastify) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
  }

  await fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET,
    verify: {
      allowedIss: 'notes-platform-auth',
      allowedAud: 'notes-platform-api',
    },
  });

  fastify.decorate('authenticate', async function authenticate(request, reply) {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ message: 'Unauthorized' });
    }
  });
}

export default fp(authPlugin);
```

Register it before `notesRoutes`, add `@fastify/jwt` and `fastify-plugin` to notes dependencies,
and pass the same secret to notes in local Compose. Production should prefer asymmetric signing:
auth holds the private key and notes verifies with the public key.

### C5. Caller-controlled user IDs and missing ownership checks

Responsible code:

- List: `services/notes-service/src/controllers/notesController.js:4-6`
- Get: `services/notes-service/src/controllers/notesController.js:9-29`
- Create: `services/notes-service/src/controllers/notesController.js:32-40`
- Update: `services/notes-service/src/controllers/notesController.js:43-55`
- Delete: `services/notes-service/src/controllers/notesController.js:58-65`

Root cause: identity comes from body/query parameters, and item queries contain no `user_id`
predicate. This is an insecure direct object reference vulnerability.

Corrected query pattern:

```js
export async function listNotes(request) {
  const { rows } = await this.pg.query(
    `SELECT id, user_id, title, content, created_at, updated_at
     FROM notes
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [request.user.sub],
  );
  return rows;
}

export async function createNote(request, reply) {
  const { title, content = '' } = request.body;
  const { rows } = await this.pg.query(
    `INSERT INTO notes (user_id, title, content)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, title, content, created_at, updated_at`,
    [request.user.sub, title, content],
  );
  return reply.code(201).send(rows[0]);
}

export async function getNote(request, reply) {
  const { rows } = await this.pg.query(
    `SELECT id, user_id, title, content, created_at, updated_at
     FROM notes WHERE id = $1 AND user_id = $2`,
    [request.params.id, request.user.sub],
  );
  if (!rows[0]) return reply.code(404).send({ message: 'Note not found' });
  return rows[0];
}

export async function updateNote(request, reply) {
  const { rows } = await this.pg.query(
    `UPDATE notes
     SET title = $1, content = $2, updated_at = now()
     WHERE id = $3 AND user_id = $4
     RETURNING id, user_id, title, content, created_at, updated_at`,
    [request.body.title, request.body.content, request.params.id, request.user.sub],
  );
  if (!rows[0]) return reply.code(404).send({ message: 'Note not found' });
  return rows[0];
}

export async function deleteNote(request, reply) {
  const result = await this.pg.query(
    'DELETE FROM notes WHERE id = $1 AND user_id = $2',
    [request.params.id, request.user.sub],
  );
  if (!result.rowCount) {
    return reply.code(404).send({ message: 'Note not found' });
  }
  return reply.code(204).send();
}
```

### C6. Registration converts every database failure into a duplicate-user response

Responsible code: `services/auth-service/src/controllers/authController.js:18-20`

Root cause: connection failures, missing tables, invalid SQL, and constraint failures all become
`409 User already exists`. This directly explains inconsistent and misleading Postman errors.

Corrected code:

```js
} catch (error) {
  if (error.code === '23505') {
    return reply.code(409).send({ message: 'User already exists' });
  }
  req.log.error({ err: error }, 'Registration failed');
  throw error;
}
```

Hashing should remain outside database error classification but inside an overall route error
boundary. Do not return internal database details to clients.

### C7. JWT configuration is insecure and incomplete

Responsible code: `services/auth-service/src/plugins/jwt.js:5-17` and
`services/auth-service/src/controllers/authController.js:42-46`

Root cause: the code silently uses a known fallback secret, ignores `JWT_EXPIRES_IN`, and sets no
issuer/audience. A missing production secret therefore does not fail startup, and tokens do not
have an application-defined expiry.

Corrected code:

```js
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');

await fastify.register(fastifyJwt, {
  secret: process.env.JWT_SECRET,
  sign: {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    iss: 'notes-platform-auth',
    aud: 'notes-platform-api',
  },
});
```

The existing password hashing and comparison calls use bcrypt correctly, but registration should
limit password byte length and use a stronger minimum than six characters.

## Medium Priority Issues

### M1. Request validation is incomplete

Responsible code: `services/auth-service/src/routes/auth.js:5-22` and
`services/notes-service/src/routes/notes.js:5-33`

- Login has no body schema.
- Note IDs and user IDs are not validated as UUIDs.
- Create requires only `user_id`, not title/content.
- Update and delete have no schemas.
- List does not require its current `user_id` query parameter.
- Schemas do not consistently set `additionalProperties: false`.

Corrected route pattern:

```js
const noteParams = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
};

const noteBody = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'content'],
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 200 },
    content: { type: 'string', maxLength: 100000 },
  },
};

fastify.addHook('preHandler', fastify.authenticate);
fastify.post('/notes', { schema: { body: noteBody } }, controller.createNote);
fastify.put('/notes/:id', {
  schema: { params: noteParams, body: noteBody },
}, controller.updateNote);
```

Use the same structured schema for login and registration, normalize email to lowercase, and
trim it before querying.

### M2. Redis is configured but never registered

Responsible code: empty block at `services/notes-service/src/app.js:24-25`

Root cause: `redis.js` is never imported or registered, so `this.redis` is always absent.

Corrected code:

```js
import redisPlugin from './plugins/redis.js';

if (process.env.REDIS_URL) {
  app.register(redisPlugin);
}
```

However, the current Redis close hook at `services/notes-service/src/plugins/redis.js:9-16`
mixes `async` and `done`, which Fastify rejects. Use one style:

```js
fastify.addHook('onClose', async () => {
  await redis.quit();
});
```

Cache keys must include the authenticated user or cached notes must be ownership-checked before
returning. Redis failures should degrade gracefully rather than fail note requests.

### M3. Health endpoints are shallow

Responsible code:

- `services/auth-service/src/app.js:17`
- `services/notes-service/src/routes/health.js:2-5`

Both endpoints return `ok` without checking dependencies. Add separate liveness and readiness
routes. Readiness should execute `SELECT 1`; include Redis only if it is required for serving.

### M4. No deliberate error-handler contract

Fastify's default handler produces inconsistent response shapes. Add a global handler that:

- preserves Fastify validation status `400`;
- maps known domain/database errors;
- logs unexpected errors once with request ID;
- returns a stable `{ message, code, requestId }` body;
- never exposes SQL, stack traces, secrets, or password data.

### M5. Logging lacks operational context and redaction

Auth enables logging by default; notes only logs when callers pass logger options. Configure both
consistently and redact `authorization`, `cookie`, and password fields. Add service name and
environment fields. The default request IDs are useful but should be returned in error responses.

### M6. Database and process lifecycle are incomplete

Both pool plugins correctly release their startup client and close the pool in `onClose`.
However:

- no pool error listener is logged;
- no query timeout is configured;
- no SIGTERM/SIGINT handler calls `app.close()`;
- the container exits seen in `docker compose ps` were signal exit `143`;
- startup checks connectivity but not schema version.

### M7. Docker images run development tooling

Responsible code:

- `services/auth-service/dockerfile:8,15`
- `services/notes-service/dockerfile:6,11-13`

Both images use `npm install` and `CMD npm run dev`, so production runs `nodemon`. Notes exposes
3000 while Compose runs it on 3002. Use `npm ci --omit=dev`, `CMD ["npm", "start"]`, set
`NODE_ENV=production`, and expose the actual configured port.

`pg` must first move from `devDependencies` to `dependencies`; otherwise production-only installs
cannot start either service.

### M8. Direct runtime dependencies are undeclared

Both services import `fastify-plugin` but rely on a transitive installation. Declare it directly.
Both import `pg` at runtime but list it under `devDependencies`. `sender.js` imports
`@azure/service-bus`, which is not installed at all.

### M9. Tests provide false confidence

Responsible sections:

- Test-only identity injection: `services/notes-service/src/app.js:12-19`
- Tests send caller-controlled IDs:
  `services/notes-service/tests/notes.test.js:34-39`
- Integration tests do the same:
  `tests/integration/notes.test.js:43-47`

The tests do not exercise a real login token against notes, unauthorized requests, cross-user
access, invalid IDs, missing fields, duplicate registration, or missing schema. The unit notes
test creates only `notes` and assumes `users` already exists, so it is order/state dependent.

`tests/helpers/reset-db.js:18-42` drops and recreates tables on whatever `DATABASE_URL` is set.
Add a guard requiring `NODE_ENV=test` and a database name ending in `_test` before destructive
operations.

The current test run could not start because PostgreSQL was stopped and port 5432 refused the
connection. The supplied screenshot shows seven passing tests in a previously prepared database,
but those tests do not validate production authentication or isolation.

### M10. CI does not run migrations and versioning is inconsistent

`.github/tests.yml` creates a database and runs `npm test`, but no production migration is
applied. Tests create their own divergent schema. Root uses Jest 30 while auth declares Jest 29
and notes declares no Jest dependency. Standardize one root workspace test toolchain and apply
the real migrations to the test database.

### M11. Environment configuration conflicts

- Compose notes URL: `notesdb`
- Modified `services/notes-service/.env.example`: `authdb`
- Root `.env.test`: `notes_test`
- Auth service test env: also `notes_test`
- Notes service `.env.test`: separate `DB_*` values that the application ignores
- README says PostgreSQL host port 5433, while Compose publishes 5432
- `JWT_EXPIRES_IN` exists in auth `.env.example` but is ignored
- `AUTH_SERVICE_URL` exists in Compose but is ignored

Create one documented env contract per service and validate it at startup.

## Cleanup Opportunities

1. Delete `services/auth-service/src/app.js:22-26`. It creates a second unused Fastify instance
   and its close hook references undefined `db`.
2. Delete the unused `healthRoutes` import in
   `services/notes-service/src/index.js:3`.
3. Either remove `services/auth-service/src/sender.js` or implement it fully. It is dead code,
   imports a missing package, opens a client at module load, and has no shutdown handling.
4. Remove unused `@fastify/cors` dependencies or explicitly register CORS with an allowlist.
5. Remove Redis until it has a measured purpose, or finish and test the integration.
6. Let PostgreSQL generate note UUIDs instead of generating them in both SQL and application code.
7. Rename lowercase `dockerfile` files to conventional `Dockerfile` for portable tooling.
8. Remove obsolete Compose `version: "3.8"`.
9. Replace broad `SELECT *` with explicit response columns.
10. Update README ports, setup, migration commands, authentication requirements, and full CRUD
    endpoints.
11. Avoid duplicate service-specific and root test dependency trees unless npm workspaces are
    configured intentionally.

## Why Postman Results Are Inconsistent

### `409 User already exists`

The screenshot's PostgreSQL log shows a real duplicate email constraint violation. That response
is correct for that request. However, the same controller also returns 409 for every other
database failure, so a missing table or connection error can misleadingly produce the same text.

### `500`

Likely causes in the current code:

- auth connects to hostname `db` instead of `postgres`;
- database or table does not exist because migrations were not run;
- note insert violates `notes.user_id -> users.id`;
- login receives malformed/missing fields and has no schema;
- unhandled PostgreSQL and Redis errors use Fastify's default 500 response.

### “User not available” / foreign-key failure

The user exists in `authdb.users`, not `notesdb.users`. The notes foreign key cannot see the auth
record. Manually inserting a dummy notes-database user made the screenshot request work but is
not a valid service flow.

### Database appears empty

There are several distinct databases: `authdb`, `notesdb`, and `notes_test`. Registration affects
only `authdb`. Notes affect only `notesdb`. Tests affect `notes_test` and reset its tables. Also,
the named Docker volume persists data across normal container restarts, while init scripts only
run on first volume creation. Querying a different database or stale volume therefore produces
apparently contradictory results.

## Corrected Auth Controller Core

```js
import bcrypt from 'bcrypt';

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

export async function register(request, reply) {
  const email = normalizeEmail(request.body.email);
  const passwordHash = await bcrypt.hash(request.body.password, 12);

  try {
    const { rows } = await this.pg.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email, created_at`,
      [email, passwordHash],
    );
    return reply.code(201).send(rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return reply.code(409).send({ message: 'User already exists' });
    }
    request.log.error({ err: error }, 'Registration failed');
    throw error;
  }
}

export async function login(request, reply) {
  const email = normalizeEmail(request.body.email);
  const { rows } = await this.pg.query(
    `SELECT id, email, password_hash FROM users WHERE email = $1`,
    [email],
  );
  const user = rows[0];
  const valid = user && await bcrypt.compare(request.body.password, user.password_hash);

  if (!valid) {
    return reply.code(401).send({ message: 'Invalid credentials' });
  }

  return reply.send({
    token: await reply.jwtSign({ email: user.email }, { sub: user.id }),
  });
}
```

## Postman Testing Guide

These requests describe the corrected API, where notes derive `user_id` from the bearer token.
Set Postman variables:

- `authUrl = http://localhost:3001`
- `notesUrl = http://localhost:3002`
- `token` from login
- `noteId` from create

### 1. Register

```http
POST {{authUrl}}/api/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "CorrectHorseBatteryStaple123!"
}
```

Expected: `201` with `id`, `email`, and `created_at`. Use a new email or expect `409`.

### 2. Login

```http
POST {{authUrl}}/api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "CorrectHorseBatteryStaple123!"
}
```

Expected: `200` with `{ "token": "..." }`.

Postman Tests script:

```js
pm.environment.set('token', pm.response.json().token);
```

### 3. Create Note

```http
POST {{notesUrl}}/api/notes
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "title": "First note",
  "content": "Created through the protected notes API."
}
```

Expected: `201`. Do not send `user_id`.

```js
pm.environment.set('noteId', pm.response.json().id);
```

### 4. Get Notes

```http
GET {{notesUrl}}/api/notes
Authorization: Bearer {{token}}
```

Expected: `200` array containing only the authenticated user's notes.

Single-note check:

```http
GET {{notesUrl}}/api/notes/{{noteId}}
Authorization: Bearer {{token}}
```

### 5. Update Note

```http
PUT {{notesUrl}}/api/notes/{{noteId}}
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "title": "Updated note",
  "content": "Updated content."
}
```

Expected: `200`. A different user's token should receive `404`.

### 6. Delete Note

```http
DELETE {{notesUrl}}/api/notes/{{noteId}}
Authorization: Bearer {{token}}
```

Expected: `204` with an empty response body. Repeating the request should return `404`.

## Step-by-Step Repair Plan

1. Decide and document database ownership. Keep separate `authdb` and `notesdb`; remove the
   notes-side `users` table and foreign key.
2. Fix the auth pool so `DATABASE_URL` is authoritative. Add startup env validation.
3. Add reproducible, versioned migrations and run them before APIs start. Verify from a clean
   database volume.
4. Add JWT verification to notes. Derive identity only from `request.user.sub`.
5. Add `user_id = request.user.sub` to every note read/update/delete query.
6. Replace body/query `user_id` schemas with authenticated note schemas and UUID params.
7. Require a non-default JWT secret; add expiry, issuer, and audience. Pass verification
   configuration to notes.
8. Correct auth error classification and add one stable global error response contract.
9. Move `pg` to runtime dependencies; declare `fastify-plugin` and notes `@fastify/jwt`
   explicitly. Remove missing/dead Azure code or add it intentionally.
10. Change Dockerfiles to `npm ci --omit=dev` and `npm start`; align ports and add graceful
    shutdown.
11. Either register and harden Redis or remove it. Do not leave configured dead infrastructure.
12. Rewrite tests to migrate a guarded `_test` database and test register -> login -> bearer
    token -> full CRUD, unauthorized access, and cross-user isolation.
13. Fix CI to use the real migrations and one consistent Jest toolchain.
14. Update README and env examples, then run the full Postman sequence from a clean deployment.

## Verification Performed

- Read all application source, migrations, tests, package manifests, env examples, Compose,
  Dockerfiles, README, CI, and database helper scripts.
- Inspected all supplied screenshots.
- Confirmed with `pg` at runtime that the auth pool configuration resolves its host to `db`.
- `node --check` passed for the main app and controller files.
- `docker compose config` succeeds but reports the obsolete `version` field.
- Active Compose containers were stopped; auth/notes had exited with code 143.
- `npm test` could not run because PostgreSQL was not listening on localhost:5432.

