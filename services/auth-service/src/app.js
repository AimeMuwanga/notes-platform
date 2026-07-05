// src/app.js
import 'dotenv/config';
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import dbPlugin from './plugins/db.js';
import jwtPlugin from './plugins/jwt.js';
import authRoutes from './routes/auth.js';

export default function buildApp(opts = {}) {
    const fastify = Fastify({
        logger: opts.logger ?? {
            redact: ['req.headers.authorization', 'req.body.password']
        }
    });

    fastify.register(helmet);
    fastify.register(dbPlugin);
    fastify.register(jwtPlugin);
    fastify.register(authRoutes, { prefix: '/api/auth' });

    fastify.get('/health', async () => ({ status: 'ok' }));
    fastify.get('/ready', async function () {
        await this.pg.query('SELECT 1');
        return { status: 'ready' };
    });

    fastify.setErrorHandler((err, request, reply) => {
        if (err.validation) {
            return reply.code(400).send({
                message: 'Validation failed',
                details: err.validation
            });
        }

        request.log.error({ err }, 'Unhandled request error');
        return reply.code(err.statusCode || 500).send({
            message: err.statusCode && err.statusCode < 500 ? err.message : 'Internal server error'
        });
    });

    return fastify;
}
