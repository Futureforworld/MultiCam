export const clients = [
  {
    id: 1,
    name: 'Farmácia Central',
    status: 'online',
    cameras: 12
  },
  {
    id: 2,
    name: 'Padaria São José',
    status: 'online',
    cameras: 8
  },
  {
    id: 3,
    name: 'Mercado Bom Preço',
    status: 'attention',
    cameras: 16
  }
];

export const devices = [
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

export const cameras = [
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