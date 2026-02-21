// src/index.js
import buildApp from './app.js';

const port = process.env.PORT || 3001;
const app = buildApp();


try {
    await app.listen({ port: Number(port), host: '0.0.0.0' });
    app.log.info(`Auth service running on ${port}`);
} catch (err) {
    app.log.error(err);
    process.exit(1);
}