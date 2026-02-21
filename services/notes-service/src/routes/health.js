// src/routes/health.js
export default async function healthRoutes(fastify) {
    fastify.get('/health', async () => {
        return { status: 'ok' };
    });
}
