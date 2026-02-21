// src/controllers/authController.js
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

export async function register(req, reply) {
    const { email, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);

    try {
        const { rows } = await this.pg.query(
            `INSERT INTO users (id, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, email`,
            [uuidv4(), email, passwordHash]
        );

        return reply.code(201).send(rows[0]);
    } catch (err) {
        return reply.code(409).send({ message: 'User already exists' });
    }
}

export async function login(req, reply) {
    const { email, password } = req.body;

    const { rows } = await this.pg.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
    );

    if (rows.length === 0) {
        return reply.code(401).send({ message: 'Invalid credentials' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
        return reply.code(401).send({ message: 'Invalid credentials' });
    }

    // Accessing the jwt decoration via 'this'
    const token = this.jwt.sign({
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