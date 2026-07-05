// src/controllers/authController.js
import bcrypt from 'bcrypt';

function normalizeEmail(email) {
    return email.trim().toLowerCase();
}

export async function register(req, reply) {
    const email = normalizeEmail(req.body.email);
    const passwordHash = await bcrypt.hash(req.body.password, 12);

    try {
        const { rows } = await this.pg.query(
            `INSERT INTO users (email, password_hash)
             VALUES ($1, $2)
             RETURNING id, email, created_at`,
            [email, passwordHash]
        );

        return reply.code(201).send(rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return reply.code(409).send({ message: 'User already exists' });
        }

        req.log.error({ err }, 'Registration failed');
        throw err;
    }
}

export async function login(req, reply) {
    const email = normalizeEmail(req.body.email);

    const { rows } = await this.pg.query(
        'SELECT id, email, password_hash FROM users WHERE email = $1',
        [email]
    );

    const user = rows[0];
    const valid = user && await bcrypt.compare(req.body.password, user.password_hash);

    if (!valid) {
        return reply.code(401).send({ message: 'Invalid credentials' });
    }

    const token = await reply.jwtSign({
        sub: user.id,
        email: user.email
    });

    return reply.send({ token });
}

export async function me(req, reply) {
    // req.user is populated by the jwtVerify hook/decorator
    return reply.send({
        userId: req.user.sub,
        email: req.user.email
    });
}
