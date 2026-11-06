
import { canAccessClient } from '../services/authorizationService.js';

export default async function camerasRoutes(app) {
  const db = app.db;

  const allowedStatuses = ['online', 'offline', 'attention'];

  const allowedProtocols = [
    'ONVIF',
    'RTSP',
    'API',
    'ONVIF / RTSP',
    'API / RTSP'
  ];

  const allowedStreams = ['H.264', 'H.265'];

  const allowedResolutions = [
    '720p',
    '1080p',
    '2MP',
    '4MP',
    '5MP',
    '8MP'
  ];

  // GET — listar câmeras autorizadas para o usuário
  app.get('/api/cameras', {
    preHandler: app.authenticate
  }, async (request) => {
    const clientIds = request.authUser.clientIds;

    let cameras;

    if (clientIds === null) {
      cameras = db.prepare(`
        SELECT *
        FROM cameras
        ORDER BY id
      `).all();
    } else if (clientIds.length === 0) {
      cameras = [];
    } else {
      const placeholders = clientIds.map(() => '?').join(', ');

      cameras = db.prepare(`
        SELECT *
        FROM cameras
        WHERE clientId IN (${placeholders})
        ORDER BY id
      `).all(...clientIds);
    }

    cameras = cameras.map(camera => ({
      ...camera,
      ptz: Boolean(camera.ptz),
      audio: Boolean(camera.audio)
    }));

    return {
      total: cameras.length,
      cameras
    };
  });

  // POST — cadastrar uma câmera
  app.post('/api/cameras', {
    preHandler: app.authenticate
  }, async (request, reply) => {
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
      !Number.isSafeInteger(clientId) ||
      clientId <= 0 ||
      !Number.isSafeInteger(deviceId) ||
      deviceId <= 0 ||
      typeof name !== 'string' ||
      !name.trim() ||
      !Number.isSafeInteger(channel) ||
      channel <= 0
    ) {
      return reply.code(400).send({
        error: 'clientId, deviceId, name e channel válidos são obrigatórios'
      });
    }

    if (
      !allowedStatuses.includes(status) ||
      !allowedProtocols.includes(protocol) ||
      !allowedStreams.includes(stream) ||
      !allowedResolutions.includes(resolution) ||
      typeof ptz !== 'boolean' ||
      typeof audio !== 'boolean'
    ) {
      return reply.code(400).send({
        error: 'Um ou mais campos da câmera possuem valores inválidos'
      });
    }

    // Verificar autorização do usuário sobre o cliente
    if (!canAccessClient(request.authUser, clientId)) {
      return reply.code(403).send({
        error: 'Você não possui autorização para acessar este cliente.'
      });
    }

    const device = db.prepare(`
      SELECT id, clientId, channels
      FROM devices
      WHERE id = ?
    `).get(deviceId);

    if (!device || device.clientId !== clientId) {
      return reply.code(400).send({
        error: 'O dispositivo não existe ou não pertence ao cliente informado'
      });
    }

    if (channel > device.channels) {
      return reply.code(400).send({
        error: `O canal informado excede a capacidade do dispositivo (${device.channels} canais)`
      });
    }

    const existingCamera = db.prepare(`
      SELECT id
      FROM cameras
      WHERE deviceId = ? AND channel = ?
    `).get(deviceId, channel);

    if (existingCamera) {
      return reply.code(409).send({
        error: 'Já existe uma câmera cadastrada neste canal do dispositivo'
      });
    }

    const result = db.prepare(`
      INSERT INTO cameras (
        clientId, deviceId, name, channel, status,
        protocol, stream, resolution, ptz, audio
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      clientId,
      deviceId,
      name.trim(),
      channel,
      status,
      protocol,
      stream,
      resolution,
      ptz ? 1 : 0,
      audio ? 1 : 0
    );

    const camera = db.prepare(`
      SELECT *
      FROM cameras
      WHERE id = ?
    `).get(Number(result.lastInsertRowid));

    return reply.code(201).send({
      ...camera,
      ptz: Boolean(camera.ptz),
      audio: Boolean(camera.audio)
    });
  });
}
