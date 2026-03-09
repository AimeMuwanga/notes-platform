// services/notes-service/tests/notes.test.js
import buildApp from '../src/app';
import { Pool }  from 'pg';
import { v4 as uuidv4 } from 'uuid';

let app;
let pool;

beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/notesdb_test';
   
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    // Setup tables if they don't exist
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
    await pool.query(
        'INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)',
        [userId, 'testuser@example.com', 'dummy_hash']
    );

    // 1. Create Note
    const createRes = await app.inject({
        method: 'POST',
        url: '/api/notes',
        headers: { 'x-mock-user-id': userId }, // Required for middleware
        payload: { user_id: userId, title: 'Test', content: 'Hello' }
    });
    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.payload);
    expect(created).toHaveProperty('id');

    // 2. Get Note
    const getRes = await app.inject({ 
        method: 'GET', 
        url: `/api/notes/${created.id}`,
        headers: { 'x-mock-user-id': userId }
    });
    expect(getRes.statusCode).toBe(200);
    const fetched = JSON.parse(getRes.payload);
    expect(fetched.title).toBe('Test');

    // 3. Update Note
    const updRes = await app.inject({
        method: 'PUT',
        url: `/api/notes/${created.id}`,
        headers: { 'x-mock-user-id': userId },
        payload: { title: 'Updated', content: 'Updated content' }
    });
    expect(updRes.statusCode).toBe(200);
    const updated = JSON.parse(updRes.payload);
    expect(updated.title).toBe('Updated');

    // 4. Delete Note
    const delRes = await app.inject({ 
        method: 'DELETE', 
        url: `/api/notes/${created.id}`,
        headers: { 'x-mock-user-id': userId }
    });
    expect(delRes.statusCode).toBe(204);

    // 5. Verify 404
    const notFound = await app.inject({ 
        method: 'GET', 
        url: `/api/notes/${created.id}`,
        headers: { 'x-mock-user-id': userId }
    });
    expect(notFound.statusCode).toBe(404);
});