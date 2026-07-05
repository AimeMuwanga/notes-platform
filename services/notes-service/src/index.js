// src/index.js
import buildApp from './app.js';

const port = process.env.PORT || 3002;
const app = buildApp({ logger: true });

async function shutdown(signal) {
    app.log.info({ signal }, 'Shutting down notes service');
    await app.close();
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);


async function start() {
    try {
        await app.listen({ port: Number(port), host: '0.0.0.0' });
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}

start();
