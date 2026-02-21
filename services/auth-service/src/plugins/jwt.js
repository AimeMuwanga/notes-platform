// src/plugins/jwt.js
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';

async function jwtPlugin(fastify, opts) {
    fastify.register(fastifyJwt, {
        secret: process.env.JWT_SECRET || 'super-secret-key-change-me'
    });


    fastify.decorate("authenticate", async function (request, reply) {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.send(err);
        }
    });
}

export default fp(jwtPlugin);