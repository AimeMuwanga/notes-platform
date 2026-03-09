// tests/integration/notes.test.js
import request from 'supertest';
import { resetDb, pool } from '../helpers/reset-db';
import buildApp from '../../services/notes-service/src/app.js';

describe('Notes API', () => {
  let app;
  let server;

  beforeAll(async () => {
    app = buildApp({ logger: false }); 
    server = app.server;
    await app.ready(); 
  });

  beforeEach(async () => {
    await resetDb(); 
  });

  afterAll(async () => {
    await app.close();
    await pool.end(); 
  });

  it('should create a new note in the database', async () => {
    const testUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      password_hash: 'hashed_password'
    };
    
    await pool.query(
      'INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)',
      [testUser.id, testUser.email, testUser.password_hash]
    );

    const newNote = { 
      title: 'Test Title', 
      content: 'Test Content',
      user_id: testUser.id 
    }; 

    const response = await request(server)
      .post('/api/notes')
      .set('x-mock-user-id', testUser.id) // Corrected: Pass mock header
      .send(newNote)
      .set('Accept', 'application/json');

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.title).toBe(newNote.title);
    expect(response.body.user_id).toBe(testUser.id);

    const dbResult = await pool.query('SELECT * FROM notes WHERE id = $1', [response.body.id]);
    expect(dbResult.rows[0]).toBeDefined();
  });

  it('should get all notes', async () => {
    const testUser = {
      id: '123e4567-e89b-12d3-a456-426614174001',
      email: 'test2@example.com',
      password_hash: 'hashed_password'
    };
    
    await pool.query(
      'INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)',
      [testUser.id, testUser.email, testUser.password_hash]
    );

    await pool.query(
      'INSERT INTO notes (id, user_id, title, content) VALUES (gen_random_uuid(), $1, $2, $3), (gen_random_uuid(), $1, $4, $5)',
      [testUser.id, 'Note 1', 'Content 1', 'Note 2', 'Content 2']
    );

    const response = await request(server)
      .get('/api/notes')
      .query({ user_id: testUser.id }) // Required by your route schema
      .set('x-mock-user-id', testUser.id)
      .set('Accept', 'application/json');

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThanOrEqual(2);
  });

  it('should get a single note by id', async () => {
    const testUser = { id: '123e4567-e89b-12d3-a456-426614174002', email: 't3@ex.com', password_hash: 'h' };
    await pool.query('INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)', [testUser.id, testUser.email, testUser.password_hash]);

    const noteResult = await pool.query(
      'INSERT INTO notes (id, user_id, title, content) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING *',
      [testUser.id, 'Single Note', 'Single Content']
    );
    const testNote = noteResult.rows[0];

    const response = await request(server)
      .get(`/api/notes/${testNote.id}`)
      .set('x-mock-user-id', testUser.id)
      .set('Accept', 'application/json');

    expect(response.statusCode).toBe(200);
    expect(response.body.id).toBe(testNote.id);
  });

  it('should update a note', async () => {
    const testUser = { id: '123e4567-e89b-12d3-a456-426614174003', email: 't4@ex.com', password_hash: 'h' };
    await pool.query('INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)', [testUser.id, testUser.email, testUser.password_hash]);

    const noteResult = await pool.query(
      'INSERT INTO notes (id, user_id, title, content) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING *',
      [testUser.id, 'Original', 'Content']
    );
    const testNote = noteResult.rows[0];

    const response = await request(server)
      .put(`/api/notes/${testNote.id}`)
      .set('x-mock-user-id', testUser.id)
      .send({ title: 'Updated Title', content: 'Updated Content' });

    expect(response.statusCode).toBe(200);
    expect(response.body.title).toBe('Updated Title');
  });

  it('should delete a note', async () => {
    const testUser = { id: '123e4567-e89b-12d3-a456-426614174004', email: 't5@ex.com', password_hash: 'h' };
    await pool.query('INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)', [testUser.id, testUser.email, testUser.password_hash]);

    const noteResult = await pool.query(
      'INSERT INTO notes (id, user_id, title, content) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING *',
      [testUser.id, 'To Delete', 'Content']
    );
    
    const response = await request(server)
      .delete(`/api/notes/${noteResult.rows[0].id}`)
      .set('x-mock-user-id', testUser.id);

    expect(response.statusCode).toBe(204);
  });
});