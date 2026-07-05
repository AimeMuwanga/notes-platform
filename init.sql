SELECT 'CREATE DATABASE notesdb'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'notesdb')\gexec
