const buildApp = require('../src/app');

let app;

beforeAll(async () => {
    process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5433/authdb';
    process.env.JWT_SECRET = 'testsecret';
    app = buildApp({ logger: false });
    await app.ready();
});

afterAll(async () => {
    await app.close();
});

test('register -> login -> me', async () => {
    const email = `user${Date.now()}@test.com`;
    const password = 'password123';

    const register = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email, password }
    });
    expect(register.statusCode).toBe(201);

    const login = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, password }
    });
    expect(login.statusCode).toBe(200);

    const { token } = JSON.parse(login.payload);

    const me = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
            authorization: `Bearer ${token}`
        }
    });

    expect(me.statusCode).toBe(200);
});
