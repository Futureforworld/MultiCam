
import { db } from '../database/database.js';

export default async function clientCamerasRoutes(app) {
  // GET — listar câmeras de um cliente
  app.get('/api/clients/:clientId/cameras', async (request, reply) => {
    const clientId = Number(request.params.clientId);

    if (!Number.isInteger(clientId) || clientId <= 0) {
      return reply.code(400).send({
        error: 'ID do cliente inválido'
      });
    }

    const client = db.prepare(`
      SELECT id FROM clients WHERE id = ?
    `).get(clientId);

    if (!client) {
      return reply.code(404).send({
        error: 'Cliente não encontrado'
      });
    }

    const cameras = db.prepare(`
      SELECT *
      FROM cameras
      WHERE clientId = ?
      ORDER BY id
    `).all(clientId).map(camera => ({
      ...camera,
      ptz: Boolean(camera.ptz),
      audio: Boolean(camera.audio)
    }));

    return {
      clientId,
      total: cameras.length,
      cameras
    };
  });
}
