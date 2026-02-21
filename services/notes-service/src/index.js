// src/index.js
import buildApp from './app.js';
import healthRoutes from './routes/health.js';

const port = process.env.PORT || 3000;
const app = buildApp({ logger: true });


async function start() {
    try {
        
        await app.listen({ port: Number(port), host: '0.0.0.0' });
        
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}

start();