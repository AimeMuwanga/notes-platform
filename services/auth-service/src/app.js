// src/app.js
import 'dotenv/config';
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import dbPlugin from './plugins/db.js';
import jwtPlugin from './plugins/jwt.js';
import authRoutes from './routes/auth.js';

export default function buildApp(opts = {}) {
    const fastify = Fastify({ logger: opts.logger ?? true });

    fastify.register(helmet);
    fastify.register(dbPlugin);
    fastify.register(jwtPlugin);
    fastify.register(authRoutes, { prefix: '/api/auth' });

    fastify.get('/health', async () => ({ status: 'ok' }));

    return fastify;
}