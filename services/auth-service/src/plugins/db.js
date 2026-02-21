// src/plugins/db.js
import fp from 'fastify-plugin';
import pg from 'pg';

async function dbPlugin(fastify, opts) {
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 5000
    });

    try {
        const client = await pool.connect();
        fastify.log.info('Connected to PostgreSQL successfully');
        client.release(); // Important: release the test client back to the pool

        fastify.decorate('pg', pool);
    } catch (err) {
        fastify.log.error(`Database connection failed: ${err.message}`);
        throw err;
    }

    
    fastify.addHook('onClose', async (instance) => {
        await pool.end();
    });
}

export default fp(dbPlugin);