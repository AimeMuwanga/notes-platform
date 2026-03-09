// src/app.js
import 'dotenv/config';
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import dbPlugin from './plugins/db.js';
import notesRoutes from './routes/notes.js';
import healthRoutes from './routes/health.js'; 

export default function buildApp(opts = {}) { 
    const app = Fastify(opts); 

    if (process.env.NODE_ENV === 'test') {
    app.addHook('onRequest', async (request, reply) => {
      const mockUserId = request.headers['x-mock-user-id'];
      if (mockUserId) {
        request.user = { id: mockUserId }; 
      }
    });
  }

    app.register(helmet);
    app.register(dbPlugin);

    if (process.env.REDIS_URL) {
    }

    app.register(notesRoutes, { prefix: '/api' });
    app.register(healthRoutes); 

    return app;
}
