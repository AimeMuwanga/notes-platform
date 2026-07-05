// src/app.js
import 'dotenv/config';
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import dbPlugin from './plugins/db.js';
import authPlugin from './plugins/auth.js';
import redisPlugin from './plugins/redis.js';
import notesRoutes from './routes/notes.js';
import healthRoutes from './routes/health.js'; 

export default function buildApp(opts = {}) { 
    const app = Fastify({
        ...opts,
        logger: opts.logger ?? {
            redact: ['req.headers.authorization']
        }
    });

    app.register(helmet);
    app.register(dbPlugin);
    app.register(authPlugin);

    if (process.env.REDIS_URL) {
        app.register(redisPlugin);
    }

    app.register(notesRoutes, { prefix: '/api' });
    app.register(healthRoutes); 

    app.setErrorHandler((err, request, reply) => {
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

    return app;
}
