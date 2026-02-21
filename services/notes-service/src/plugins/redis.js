// src/plugins/redis.js
import fp from 'fastify-plugin';
import Redis from 'ioredis';

export default fp(async function (fastify, opts) {
    const redis = new Redis(process.env.REDIS_URL);
    fastify.decorate('redis', redis);

    fastify.addHook('onClose', async (fastifyInstance, done) => {
        try {
            await redis.quit();
        } catch (e) {
            // ignore
        }
        done();
    });
});
