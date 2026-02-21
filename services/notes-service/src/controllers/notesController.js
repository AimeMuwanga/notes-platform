// src/controllers/notesController.js
import { v4 as uuidv4 } from 'uuid';

export async function listNotes(req, reply) {
    const { rows } = await this.pg.query('SELECT * FROM notes WHERE user_id = $1 ORDER BY created_at DESC', [req.query.user_id]);
    return rows;
}

export async function getNote(req, reply) {
    const { id } = req.params;

    // try cache first (if redis configured)
    if (this.redis) {
        const cached = await this.redis.get(`note:${id}`);
        if (cached) return JSON.parse(cached);
    }

    const { rows } = await this.pg.query('SELECT * FROM notes WHERE id = $1', [id]);
    if (rows.length === 0) {
        reply.code(404).send({ message: 'Note not found' });
        return;
    }
    const note = rows[0];

    if (this.redis) {
        await this.redis.set(`note:${id}`, JSON.stringify(note), 'EX', 60 * 5); // 5min cache
    }

    return note;
}

export async function createNote(req, reply) {
    const { user_id, title, content } = req.body;
    const id = uuidv4();
    const { rows } = await this.pg.query(
        `INSERT INTO notes(id, user_id, title, content) VALUES ($1, $2, $3, $4) RETURNING *`,
        [id, user_id, title, content]
    );

    reply.code(201).send(rows[0]);
}

export async function updateNote(req, reply) {
    const { id } = req.params;
    const { title, content } = req.body;
    const { rowCount, rows } = await this.pg.query(
        `UPDATE notes SET title=$1, content=$2, updated_at = now() WHERE id=$3 RETURNING *`,
        [title, content, id]
    );
    if (rowCount === 0) return reply.code(404).send({ message: 'Note not found' });

    // invalidate cache
    if (this.redis) await this.redis.del(`note:${id}`);

    return rows[0];
}

export async function deleteNote(req, reply) {
    const { id } = req.params;
    const { rowCount } = await this.pg.query('DELETE FROM notes WHERE id = $1', [id]);
    if (rowCount === 0) return reply.code(404).send({ message: 'Note not found' });

    if (this.redis) await this.redis.del(`note:${id}`);

    return reply.code(204).send();
}
