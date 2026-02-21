// src/routes/auth.js
import * as controller from '../controllers/authController.js';

export default async function authRoutes(fastify) {
    fastify.post('/register', {
        schema: {
            body: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 6 }
                }
            }
        }
    }, controller.register);

    fastify.post('/login', controller.login);

    fastify.get('/me', {
        preHandler: [fastify.authenticate]
    }, controller.me);
}                     