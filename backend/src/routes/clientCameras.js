
import {
  canAccessClient
} from '../services/authorizationService.js';

export default async function clientCamerasRoutes(app) {
  const db = app.db;
  const authenticate = app.authenticate;

  if (typeof authenticate !== 'function') {
    throw new Error(
      'Autenticação JWT não configurada para as rotas de câmeras por cliente.'
    );
  }

  // GET — listar câmeras de um cliente autorizado
  app.get('/api/clients/:clientId/cameras', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const clientId = Number(request.params.clientId);

    if (!Number.isSafeInteger(clientId) || clientId <= 0) {
      return reply.code(400).send({
        error: 'ID do cliente inválido'
      });
    }

    const client = db.prepare(`
      SELECT id
      FROM clients
      WHERE id = ?
    `).get(clientId);

    if (!client || !canAccessClient(request.authUser, clientId)) {
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
