// src/routes/auth.js
import * as controller from '../controllers/authController.js';

const credentialsBody = {
    type: 'object',
    additionalProperties: false,
    required: ['email', 'password'],
    properties: {
        email: { type: 'string', format: 'email', maxLength: 320 },
        password: { type: 'string', minLength: 8, maxLength: 72 }
    }
};

export default async function authRoutes(fastify) {
    fastify.post('/register', {
        schema: {
            body: credentialsBody
        }
    }, controller.register);

    fastify.post('/login', {
        schema: {
            body: credentialsBody
        }
    }, controller.login);

    fastify.get('/me', {
        preHandler: [fastify.authenticate]
    }, controller.me);
}
