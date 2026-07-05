export async function listNotes(req, reply) {
    const { rows } = await this.pg.query(
        `SELECT id, user_id, title, content, created_at, updated_at
         FROM notes
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [req.user.sub]
    );
    return rows;
}

export async function getNote(req, reply) {
    const { id } = req.params;
    const cacheKey = `note:${req.user.sub}:${id}`;

    // try cache first (if redis configured)
    if (this.redis) {
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
    }

    const { rows } = await this.pg.query(
        `SELECT id, user_id, title, content, created_at, updated_at
         FROM notes
         WHERE id = $1 AND user_id = $2`,
        [id, req.user.sub]
    );
    if (rows.length === 0) {
        reply.code(404).send({ message: 'Note not found' });
        return;
    }
    const note = rows[0];

    if (this.redis) {
        await this.redis.set(cacheKey, JSON.stringify(note), 'EX', 60 * 5);
    }

    return note;
}

export async function createNote(req, reply) {
    const { title, content } = req.body;
    const { rows } = await this.pg.query(
        `INSERT INTO notes(user_id, title, content)
         VALUES ($1, $2, $3)
         RETURNING id, user_id, title, content, created_at, updated_at`,
        [req.user.sub, title, content]
    );

    reply.code(201).send(rows[0]);
}

export async function updateNote(req, reply) {
    const { id } = req.params;
    const { title, content } = req.body;
    const { rowCount, rows } = await this.pg.query(
        `UPDATE notes
         SET title=$1, content=$2, updated_at = now()
         WHERE id=$3 AND user_id=$4
         RETURNING id, user_id, title, content, created_at, updated_at`,
        [title, content, id, req.user.sub]
    );
    if (rowCount === 0) return reply.code(404).send({ message: 'Note not found' });

    // invalidate cache
    if (this.redis) await this.redis.del(`note:${req.user.sub}:${id}`);

    return rows[0];
}

export async function deleteNote(req, reply) {
    const { id } = req.params;
    const { rowCount } = await this.pg.query(
        'DELETE FROM notes WHERE id = $1 AND user_id = $2',
        [id, req.user.sub]
    );
    if (rowCount === 0) return reply.code(404).send({ message: 'Note not found' });

    if (this.redis) await this.redis.del(`note:${req.user.sub}:${id}`);

    return reply.code(204).send();
}
