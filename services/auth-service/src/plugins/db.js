// src/plugins/db.js
import fp from 'fastify-plugin';
import pg from 'pg';

async function dbPlugin(fastify, opts) {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required');
    }

    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 5000,
        query_timeout: 10000
    });

    pool.on('error', (err) => {
        fastify.log.error({ err }, 'Unexpected PostgreSQL pool error');
    });

    try {
        const client = await pool.connect();
        fastify.log.info('Connected to PostgreSQL successfully');
        client.release(); 

        fastify.decorate('pg', pool);
    } catch (err) {
        fastify.log.error(`Database connection failed: ${err.message}`);
        throw err;
    }

    
    fastify.addHook('onClose', async () => {
        await pool.end();
    });
}

export default fp(dbPlugin);
