// src/routes/notes.js
import * as controller from '../controllers/notesController.js';

export default async function (fastify, opts) {
    fastify.get('/notes', {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    user_id: { type: 'string' }
                }
            }
        }
    }, controller.listNotes);

    fastify.get('/notes/:id', controller.getNote);

    fastify.post('/notes', {
        schema: {
            body: {
                type: 'object',
                required: ['user_id'],
                properties: {
                    user_id: { type: 'string' },
                    title: { type: 'string' },
                    content: { type: 'string' }
                }
            }
        }
    }, controller.createNote);

    fastify.put('/notes/:id', controller.updateNote);
    fastify.delete('/notes/:id', controller.deleteNote);
}
