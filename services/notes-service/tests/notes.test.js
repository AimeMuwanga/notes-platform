// services/notes-service/tests/notes.test.js
import buildApp from '../src/app';
import { v4 as uuidv4 } from 'uuid';
import { resetDb, pool } from '../../../tests/helpers/reset-db';

let app;

function authHeader(userId) {
    const token = app.jwt.sign(
        { sub: userId, email: `${userId}@example.com` },
        {
            iss: 'notes-platform-auth',
            aud: 'notes-platform-api'
        }
    );

    return `Bearer ${token}`;
}

beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
    await resetDb();
    app = buildApp({ logger: false });
    await app.ready();
});

beforeEach(async () => {
    await resetDb();
});

afterAll(async () => {
    await app.close();
});

test('create -> get -> update -> delete note', async () => {
    const userId = uuidv4();
    const authorization = authHeader(userId);

    // 1. Create Note
    const createRes = await app.inject({
        method: 'POST',
        url: '/api/notes',
        headers: { authorization },
        payload: { title: 'Test', content: 'Hello' }
    });
    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.payload);
    expect(created).toHaveProperty('id');
    expect(created.user_id).toBe(userId);

    // 2. Get Note
    const getRes = await app.inject({ 
        method: 'GET', 
        url: `/api/notes/${created.id}`,
        headers: { authorization }
    });
    expect(getRes.statusCode).toBe(200);
    const fetched = JSON.parse(getRes.payload);
    expect(fetched.title).toBe('Test');

    // 3. Update Note
    const updRes = await app.inject({
        method: 'PUT',
        url: `/api/notes/${created.id}`,
        headers: { authorization },
        payload: { title: 'Updated', content: 'Updated content' }
    });
    expect(updRes.statusCode).toBe(200);
    const updated = JSON.parse(updRes.payload);
    expect(updated.title).toBe('Updated');

    // 4. Delete Note
    const delRes = await app.inject({ 
        method: 'DELETE', 
        url: `/api/notes/${created.id}`,
        headers: { authorization }
    });
    expect(delRes.statusCode).toBe(204);

    // 5. Verify 404
    const notFound = await app.inject({ 
        method: 'GET', 
        url: `/api/notes/${created.id}`,
        headers: { authorization }
    });
    expect(notFound.statusCode).toBe(404);
});

test('rejects unauthenticated note requests', async () => {
    const response = await app.inject({
        method: 'POST',
        url: '/api/notes',
        payload: { title: 'No token', content: 'No token' }
    });

    expect(response.statusCode).toBe(401);
});

test('does not expose notes across users', async () => {
    const ownerId = uuidv4();
    const otherId = uuidv4();

    const createRes = await app.inject({
        method: 'POST',
        url: '/api/notes',
        headers: { authorization: authHeader(ownerId) },
        payload: { title: 'Private', content: 'Only owner can read' }
    });

    const created = JSON.parse(createRes.payload);
    const otherRead = await app.inject({
        method: 'GET',
        url: `/api/notes/${created.id}`,
        headers: { authorization: authHeader(otherId) }
    });

    expect(otherRead.statusCode).toBe(404);
});
