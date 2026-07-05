// src/plugins/auth.js
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
            allowedAud: 'notes-platform-api'
        }
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
