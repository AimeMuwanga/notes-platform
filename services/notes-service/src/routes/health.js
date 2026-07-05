// src/routes/health.js
export default async function healthRoutes(fastify) {
    fastify.get('/health', async () => {
        return { status: 'ok' };
    });

    fastify.get('/ready', async function () {
        await this.pg.query('SELECT 1');
        return { status: 'ready' };
    });
}
