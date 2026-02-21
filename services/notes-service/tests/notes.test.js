// tests/notes.test.js
const buildApp = require('../src/app');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

let app;
let pool;

beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/notesdb_test';
    // For CI: ensure a test DB exists and migrated. This test expects that a postgres instance is reachable.
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(`CREATE TABLE IF NOT EXISTS notes (id UUID PRIMARY KEY, user_id UUID, title text, content text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now())`);
    app = buildApp({ logger: false });
    await app.ready();
});

afterAll(async () => {
    await app.close();
    await pool.query('DROP TABLE IF EXISTS notes');
    await pool.end();
});

test('create -> get -> update -> delete note', async () => {
    const userId = uuidv4();
    // create
    const createRes = await app.inject({
        method: 'POST',
        url: '/api/notes',
        payload: { user_id: userId, title: 'Test', content: 'Hello' }
    });
    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.payload);
    expect(created).toHaveProperty('id');

    // get
    const getRes = await app.inject({ method: 'GET', url: `/api/notes/${created.id}` });
    expect(getRes.statusCode).toBe(200);
    const fetched = JSON.parse(getRes.payload);
    expect(fetched.title).toBe('Test');

    // update
    const updRes = await app.inject({
        method: 'PUT',
        url: `/api/notes/${created.id}`,
        payload: { title: 'Updated', content: 'Updated content' }
    });
    expect(updRes.statusCode).toBe(200);
    const updated = JSON.parse(updRes.payload);
    expect(updated.title).toBe('Updated');

    // delete
    const delRes = await app.inject({ method: 'DELETE', url: `/api/notes/${created.id}` });
    expect(delRes.statusCode).toBe(204);

    // verify 404
    const notFound = await app.inject({ method: 'GET', url: `/api/notes/${created.id}` });
    expect(notFound.statusCode).toBe(404);
});
