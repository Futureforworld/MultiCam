import { devices } from '../data/store.js';
import {
  getDeviceOverview,
  getDeviceDiagnostics
} from '../services/deviceService.js';

export default async function devicesRoutes(app) {

  // GET — listar todos os dispositivos
  app.get('/api/devices', async () => {
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

  // POST — cadastrar um novo dispositivo
  app.post('/api/devices', async (request, reply) => {

    const {
      clientId,
      name,
      type = 'NVR',
      manufacturer,
      model,
      channels = 0,
      status = 'online',
      integration = 'ONVIF'
    } = request.body;

    if (!clientId || !name) {
      return reply.code(400).send({
        error: 'clientId e nome do dispositivo são obrigatórios'
      });
    }

    const newDevice = {
      id: devices.length + 1,
      clientId,
      name,
      type,
      manufacturer,
      model,
      channels,
      status,
      integration
    };

    devices.push(newDevice);

    return reply.code(201).send(newDevice);
  });
}