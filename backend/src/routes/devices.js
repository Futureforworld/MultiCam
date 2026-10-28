
import { db } from '../database/database.js';
import {
  getDeviceOverview,
  getDeviceDiagnostics
} from '../services/deviceService.js';

export default async function devicesRoutes(app) {
  // GET — listar todos os dispositivos
  app.get('/api/devices', async () => {
    const devices = db.prepare(`
      SELECT *
      FROM devices
      ORDER BY id
    `).all();

    return {
      total: devices.length,
      devices
    };
  });

  // GET — visualizar dispositivo, cliente e câmeras
  app.get('/api/devices/:deviceId/overview', async (request, reply) => {
    const deviceId = Number(request.params.deviceId);
    const overview = getDeviceOverview(deviceId);

    if (!overview) {
      return reply.code(404).send({
        error: 'Dispositivo não encontrado'
      });
    }

    return overview;
  });

  // GET — diagnóstico técnico do dispositivo
  app.get('/api/devices/:deviceId/diagnostics', async (request, reply) => {
    const deviceId = Number(request.params.deviceId);
    const diagnostics = getDeviceDiagnostics(deviceId);

    if (!diagnostics) {
      return reply.code(404).send({
        error: 'Dispositivo não encontrado'
      });
    }

    return diagnostics;
  });

  // POST — cadastrar um dispositivo no SQLite
  app.post('/api/devices', async (request, reply) => {
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
      !Number.isInteger(Number(clientId)) ||
      Number(clientId) <= 0 ||
      typeof name !== 'string' ||
      !name.trim()
    ) {
      return reply.code(400).send({
        error: 'clientId válido e nome do dispositivo são obrigatórios'
      });
    }

    const client = db.prepare(`
      SELECT id FROM clients WHERE id = ?
    `).get(Number(clientId));

    if (!client) {
      return reply.code(400).send({
        error: 'Cliente não encontrado'
      });
    }

    if (!Number.isInteger(Number(channels)) || Number(channels) < 0) {
      return reply.code(400).send({
        error: 'channels deve ser um número inteiro maior ou igual a zero'
      });
    }

    const result = db.prepare(`
      INSERT INTO devices (
        clientId, name, type, manufacturer, model,
        channels, status, integration
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      Number(clientId),
      name.trim(),
      type,
      manufacturer,
      model,
      Number(channels),
      status,
      integration
    );

    const newDevice = db.prepare(`
      SELECT * FROM devices WHERE id = ?
    `).get(Number(result.lastInsertRowid));

    return reply.code(201).send(newDevice);
  });
}
