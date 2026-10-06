const devices = [
  {
    id: 1,
    clientId: 1,
    name: 'NVR Farmácia Central',
    type: 'NVR',
    manufacturer: 'Intelbras',
    model: 'NVD 1232',
    channels: 32,
    status: 'online',
    integration: 'ONVIF'
  },
  {
    id: 2,
    clientId: 2,
    name: 'NVR Padaria São José',
    type: 'NVR',
    manufacturer: 'Hikvision',
    model: 'DS-7608',
    channels: 8,
    status: 'online',
    integration: 'ONVIF / RTSP'
  },
  {
    id: 3,
    clientId: 3,
    name: 'DVR Mercado Bom Preço',
    type: 'DVR',
    manufacturer: 'Dahua',
    model: 'XVR',
    channels: 16,
    status: 'attention',
    integration: 'API / RTSP'
  }
];

export default async function devicesRoutes(app) {

  // GET — listar todos os dispositivos
  app.get('/api/devices', async () => {
    return {
      total: devices.length,
      devices
    };
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