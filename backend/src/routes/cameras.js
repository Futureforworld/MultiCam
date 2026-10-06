const cameras = [
  {
    id: 1,
    clientId: 1,
    deviceId: 1,
    name: 'Entrada Principal',
    channel: 1,
    status: 'online',
    protocol: 'ONVIF',
    stream: 'H.265',
    resolution: '4MP',
    ptz: false,
    audio: true
  },
  {
    id: 2,
    clientId: 1,
    deviceId: 1,
    name: 'Caixa',
    channel: 2,
    status: 'online',
    protocol: 'ONVIF',
    stream: 'H.265',
    resolution: '4MP',
    ptz: false,
    audio: false
  },
  {
    id: 3,
    clientId: 2,
    deviceId: 2,
    name: 'Área de Atendimento',
    channel: 1,
    status: 'online',
    protocol: 'RTSP',
    stream: 'H.264',
    resolution: '2MP',
    ptz: false,
    audio: true
  },
  {
    id: 4,
    clientId: 3,
    deviceId: 3,
    name: 'Estacionamento',
    channel: 1,
    status: 'attention',
    protocol: 'API / RTSP',
    stream: 'H.265',
    resolution: '4MP',
    ptz: true,
    audio: false
  }
];

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