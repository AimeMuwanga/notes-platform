// src/app.js
import 'dotenv/config';
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import dbPlugin from './plugins/db.js';
import notesRoutes from './routes/notes.js';
import healthRoutes from './routes/health.js'; // Import health routes

export default function buildApp(opts = {}) {
    const app = Fastify({ logger: opts.logger ?? true });

    app.register(helmet);
    app.register(dbPlugin);

    if (process.env.REDIS_URL) {
        // Redis setup (if needed)
    }

    app.register(notesRoutes, { prefix: '/api' });
    app.register(healthRoutes); 

    return app;
}
