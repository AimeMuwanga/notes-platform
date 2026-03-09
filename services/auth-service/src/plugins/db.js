// src/plugins/db.js
import fp from 'fastify-plugin';
import pg from 'pg';

async function dbPlugin(fastify, opts) {
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        host: process.env.NODE_ENV === 'test' ? 'localhost' : (process.env.DB_HOST || 'db'),
        
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

    
    fastify.addHook('onClose', async (instance) => {
        await pool.end();
    });
}

export default fp(dbPlugin);