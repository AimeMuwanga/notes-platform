// tests/integration/notes.test.js
import request from 'supertest';
import { resetDb, pool } from '../helpers/reset-db';
import buildAuthApp from '../../services/auth-service/src/app.js';
import buildNotesApp from '../../services/notes-service/src/app.js';

describe('Auth + Notes API', () => {
  let authApp;
  let notesApp;
  let authServer;
  let notesServer;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
    authApp = buildAuthApp({ logger: false });
    notesApp = buildNotesApp({ logger: false });
    authServer = authApp.server;
    notesServer = notesApp.server;
    await authApp.ready();
    await notesApp.ready();
  });

  beforeEach(async () => {
    await resetDb(); 
  });

  afterAll(async () => {
    await authApp.close();
    await notesApp.close();
    await pool.end(); 
  });

  it('registers, logs in, and creates a note with the bearer token', async () => {
    const email = `integration-${Date.now()}@example.com`;
    const password = 'password123';

    const register = await request(authServer)
      .post('/api/auth/register')
      .send({ email, password });

    expect(register.statusCode).toBe(201);

    const login = await request(authServer)
      .post('/api/auth/login')
      .send({ email, password });

    expect(login.statusCode).toBe(200);
    expect(login.body.token).toBeDefined();

    const create = await request(notesServer)
      .post('/api/notes')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ title: 'Integrated note', content: 'Created after login' });

    expect(create.statusCode).toBe(201);
    expect(create.body).toHaveProperty('id');
    expect(create.body.user_id).toBe(register.body.id);
    expect(create.body.title).toBe('Integrated note');
  });
});
