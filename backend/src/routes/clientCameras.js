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

export default async function clientCamerasRoutes(app) {
  app.get('/api/clients/:clientId/cameras', async (request) => {
    const clientId = Number(request.params.clientId);

    const clientCameras = cameras.filter(
      (camera) => camera.clientId === clientId
    );

    return {
      clientId,
      total: clientCameras.length,
      cameras: clientCameras
    };
  });
}