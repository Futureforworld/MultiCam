import { clients, devices, cameras } from '../data/store.js';

export function getClientOverview(clientId) {

  const client = clients.find(
    client => client.id === clientId
  );

  if (!client) {
    return null;
  }

  const clientDevices = devices.filter(
    device => device.clientId === clientId
  );

  const clientCameras = cameras.filter(
    camera => camera.clientId === clientId
  );

  return {
    client: {
      ...client,
      cameras: clientCameras.length
    },

    devices: clientDevices,

    cameras: clientCameras
  };
}