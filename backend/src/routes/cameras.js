import { cameras } from '../data/store.js';

export default async function camerasRoutes(app) {

  // GET — listar todas as câmeras
  app.get('/api/cameras', async () => {
    return {
      total: cameras.length,
      cameras
    };
  });

  // POST — cadastrar uma nova câmera
  app.post('/api/cameras', async (request, reply) => {
    const {
      clientId,
      deviceId,
      name,
      channel,
      status = 'online',
      protocol = 'ONVIF',
      stream = 'H.265',
      resolution = '4MP',
      ptz = false,
      audio = false
    } = request.body;

    if (!clientId || !deviceId || !name || !channel) {
      return reply.code(400).send({
        error: 'clientId, deviceId, name e channel são obrigatórios'
      });
    }

    const newCamera = {
      id: cameras.length + 1,
      clientId,
      deviceId,
      name,
      channel,
      status,
      protocol,
      stream,
      resolution,
      ptz,
      audio
    };

    cameras.push(newCamera);

    return reply.code(201).send(newCamera);
  });
}