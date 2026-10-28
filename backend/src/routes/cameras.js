
import { db } from '../database/database.js';

export default async function camerasRoutes(app) {
  // GET — listar todas as câmeras
  app.get('/api/cameras', async () => {
    const cameras = db.prepare(`
      SELECT *
      FROM cameras
      ORDER BY id
    `).all().map(camera => ({
      ...camera,
      ptz: Boolean(camera.ptz),
      audio: Boolean(camera.audio)
    }));

    return {
      total: cameras.length,
      cameras
    };
  });

  // POST — cadastrar uma câmera no SQLite
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
    } = request.body ?? {};

    if (
      !Number.isInteger(Number(clientId)) ||
      Number(clientId) <= 0 ||
      !Number.isInteger(Number(deviceId)) ||
      Number(deviceId) <= 0 ||
      typeof name !== 'string' ||
      !name.trim() ||
      !Number.isInteger(Number(channel)) ||
      Number(channel) <= 0
    ) {
      return reply.code(400).send({
        error: 'clientId, deviceId, name e channel válidos são obrigatórios'
      });
    }

    const device = db.prepare(`
      SELECT id, clientId
      FROM devices
      WHERE id = ?
    `).get(Number(deviceId));

    if (!device || device.clientId !== Number(clientId)) {
      return reply.code(400).send({
        error: 'O dispositivo não existe ou não pertence ao cliente informado'
      });
    }

    const result = db.prepare(`
      INSERT INTO cameras (
        clientId, deviceId, name, channel, status,
        protocol, stream, resolution, ptz, audio
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      Number(clientId),
      Number(deviceId),
      name.trim(),
      Number(channel),
      status,
      protocol,
      stream,
      resolution,
      ptz ? 1 : 0,
      audio ? 1 : 0
    );

    const camera = db.prepare(`
      SELECT * FROM cameras WHERE id = ?
    `).get(Number(result.lastInsertRowid));

    return reply.code(201).send({
      ...camera,
      ptz: Boolean(camera.ptz),
      audio: Boolean(camera.audio)
    });
  });
}
