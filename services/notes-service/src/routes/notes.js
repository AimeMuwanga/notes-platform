// src/routes/notes.js
import * as controller from '../controllers/notesController.js';

const noteParams = {
    type: 'object',
    additionalProperties: false,
    required: ['id'],
    properties: {
        id: { type: 'string', format: 'uuid' }
    }
};

const noteBody = {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'content'],
    properties: {
        title: { type: 'string', minLength: 1, maxLength: 200 },
        content: { type: 'string', maxLength: 100000 }
    }
};

export default async function (fastify, opts) {
    fastify.addHook('preHandler', fastify.authenticate);

    fastify.get('/notes', {
        schema: {
            querystring: {
                type: 'object',
                additionalProperties: false,
                properties: {}
            }
        }
    }, controller.listNotes);

    fastify.get('/notes/:id', {
        schema: {
            params: noteParams
        }
    }, controller.getNote);

    fastify.post('/notes', {
        schema: {
            body: noteBody
        }
    }, controller.createNote);

    fastify.put('/notes/:id', {
        schema: {
            params: noteParams,
            body: noteBody
        }
    }, controller.updateNote);

    fastify.delete('/notes/:id', {
        schema: {
            params: noteParams
        }
    }, controller.deleteNote);
}
