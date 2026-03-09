import { Client } from 'pg';

async function ensureTestDb() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const url = new URL(dbUrl);
  const dbName = url.pathname.slice(1); 

  
  url.pathname = '/postgres';
  const maintenanceUrl = url.toString();

  const client = new Client({ connectionString: maintenanceUrl });

  try {
    await client.connect();

    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );

    if (result.rows.length === 0) {
      console.log(`Creating test database: ${dbName}`);

      // Safely quote the identifier
      const safeDbName = dbName.replace(/"/g, '""');
      await client.query(`CREATE DATABASE "${safeDbName}"`);
    } else {
      console.log(`Test database ${dbName} already exists`);
    }
  } catch (err) {
    console.error('Error ensuring test database exists:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

ensureTestDb();