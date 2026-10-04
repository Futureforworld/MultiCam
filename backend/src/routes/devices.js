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
  app.get('/api/devices', async () => {
    return {
      total: devices.length,
      devices
    };
  });
}