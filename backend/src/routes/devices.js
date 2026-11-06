
import {
  getDeviceOverview,
  getDeviceDiagnostics
} from '../services/deviceService.js';

import {
  canAccessClient
} from '../services/authorizationService.js';

export default async function devicesRoutes(app) {
  const db = app.db;

  const authenticate = app.authenticate;

  if (typeof authenticate !== 'function') {
    throw new Error(
      'Autenticação JWT não configurada para as rotas de dispositivos.'
    );
  }

  const allowedStatuses = [
    'online',
    'offline',
    'attention'
  ];

  // GET — listar dispositivos dos clientes autorizados
  app.get('/api/devices', {
    preHandler: [authenticate]
  }, async (request) => {
    const user = request.authUser;

    let devices;

    if (user.role === 'superadmin') {
      devices = db.prepare(`
        SELECT *
        FROM devices
        ORDER BY id
      `).all();
    } else {
      devices = db.prepare(`
        SELECT devices.*
        FROM devices
        INNER JOIN user_clients
          ON user_clients.clientId = devices.clientId
        WHERE user_clients.userId = ?
        ORDER BY devices.id
      `).all(user.id);
    }

    return {
      total: devices.length,
      devices
    };
  });

  // GET — visualizar dispositivo, cliente e câmeras
  app.get('/api/devices/:deviceId/overview', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const deviceId = Number(request.params.deviceId);

    if (!Number.isSafeInteger(deviceId) || deviceId <= 0) {
      return reply.code(400).send({
        error: 'ID do dispositivo inválido'
      });
    }

    const device = db.prepare(`
      SELECT clientId
      FROM devices
      WHERE id = ?
    `).get(deviceId);

    if (!device || !canAccessClient(request.authUser, device.clientId)) {
      return reply.code(404).send({
        error: 'Dispositivo não encontrado'
      });
    }

    const overview = getDeviceOverview(db, deviceId);

    if (!overview) {
      return reply.code(404).send({
        error: 'Dispositivo não encontrado'
      });
    }

    return overview;
  });

  // GET — diagnóstico técnico do dispositivo
  app.get('/api/devices/:deviceId/diagnostics', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const deviceId = Number(request.params.deviceId);

    if (!Number.isSafeInteger(deviceId) || deviceId <= 0) {
      return reply.code(400).send({
        error: 'ID do dispositivo inválido'
      });
    }

    const device = db.prepare(`
      SELECT clientId
      FROM devices
      WHERE id = ?
    `).get(deviceId);

    if (!device || !canAccessClient(request.authUser, device.clientId)) {
      return reply.code(404).send({
        error: 'Dispositivo não encontrado'
      });
    }

    const diagnostics = getDeviceDiagnostics(db, deviceId);

    if (!diagnostics) {
      return reply.code(404).send({
        error: 'Dispositivo não encontrado'
      });
    }

    return diagnostics;
  });

  // POST — cadastrar dispositivo em cliente autorizado
  app.post('/api/devices', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const {
      clientId,
      name,
      type = 'NVR',
      manufacturer = null,
      model = null,
      channels = 0,
      status = 'online',
      integration = 'ONVIF'
    } = request.body ?? {};

    if (
      !Number.isSafeInteger(clientId) ||
      clientId <= 0 ||
      typeof name !== 'string' ||
      !name.trim()
    ) {
      return reply.code(400).send({
        error: 'clientId válido e nome do dispositivo são obrigatórios'
      });
    }

    if (
      typeof type !== 'string' ||
      !type.trim()
    ) {
      return reply.code(400).send({
        error: 'type deve ser um texto válido'
      });
    }

    if (
      (manufacturer !== null && typeof manufacturer !== 'string') ||
      (model !== null && typeof model !== 'string')
    ) {
      return reply.code(400).send({
        error: 'manufacturer e model devem ser textos ou null'
      });
    }

    if (
      !Number.isSafeInteger(channels) ||
      channels < 0
    ) {
      return reply.code(400).send({
        error: 'channels deve ser um número inteiro maior ou igual a zero'
      });
    }

    if (!allowedStatuses.includes(status)) {
      return reply.code(400).send({
        error: 'status deve ser online, offline ou attention'
      });
    }

    if (
      typeof integration !== 'string' ||
      !integration.trim()
    ) {
      return reply.code(400).send({
        error: 'integration deve ser um texto válido'
      });
    }

    const client = db.prepare(`
      SELECT id
      FROM clients
      WHERE id = ?
    `).get(clientId);

    if (!client) {
      return reply.code(400).send({
        error: 'Cliente não encontrado'
      });
    }

    if (!canAccessClient(request.authUser, clientId)) {
      return reply.code(403).send({
        error: 'Você não possui acesso a este cliente.'
      });
    }

    const result = db.prepare(`
      INSERT INTO devices (
        clientId, name, type, manufacturer, model,
        channels, status, integration
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      clientId,
      name.trim(),
      type.trim(),
      manufacturer?.trim() || null,
      model?.trim() || null,
      channels,
      status,
      integration.trim()
    );

    const newDevice = db.prepare(`
      SELECT *
      FROM devices
      WHERE id = ?
    `).get(Number(result.lastInsertRowid));

    return reply.code(201).send(newDevice);
  });
}
