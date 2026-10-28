
import { db } from '../database/database.js';

export function getClientCameraCount(clientId) {
  return db.prepare(`
    SELECT COUNT(*) AS total
    FROM cameras
    WHERE clientId = ?
  `).get(clientId).total;
}

export function getDeviceOverview(deviceId) {
  const device = db.prepare(`
    SELECT *
    FROM devices
    WHERE id = ?
  `).get(deviceId);

  if (!device) {
    return null;
  }

  const client = db.prepare(`
    SELECT id, name, status
    FROM clients
    WHERE id = ?
  `).get(device.clientId);

  const deviceCameras = db.prepare(`
    SELECT *
    FROM cameras
    WHERE deviceId = ?
    ORDER BY id
  `).all(deviceId).map(camera => ({
    ...camera,
    ptz: Boolean(camera.ptz),
    audio: Boolean(camera.audio)
  }));

  return {
    device,
    client: client
      ? {
          ...client,
          cameras: getClientCameraCount(client.id)
        }
      : null,
    cameras: deviceCameras
  };
}

export function getDeviceDiagnostics(deviceId) {
  const overview = getDeviceOverview(deviceId);

  if (!overview) {
    return null;
  }

  const { device, client, cameras: deviceCameras } = overview;

  const onlineCameras = deviceCameras.filter(
    camera => camera.status === 'online'
  );

  const offlineCameras = deviceCameras.filter(
    camera => camera.status !== 'online'
  );

  const protocols = [
    ...new Set(
      deviceCameras.flatMap(camera =>
        camera.protocol
          ? camera.protocol.split('/').map(item => item.trim())
          : []
      )
    )
  ];

  const streams = [
    ...new Set(
      deviceCameras
        .map(camera => camera.stream)
        .filter(Boolean)
    )
  ];

  const hasOnvif =
    protocols.includes('ONVIF') ||
    device.integration?.includes('ONVIF');

  const hasRtsp =
    protocols.includes('RTSP') ||
    device.integration?.includes('RTSP');

  const hasApi =
    protocols.includes('API') ||
    device.integration?.includes('API');

  return {
    device: {
      id: device.id,
      name: device.name,
      type: device.type,
      manufacturer: device.manufacturer,
      model: device.model,
      status: device.status,
      channels: device.channels
    },

    client: client
      ? {
          id: client.id,
          name: client.name
        }
      : null,

    integration: {
      configured: device.integration,
      onvif: hasOnvif,
      rtsp: hasRtsp,
      api: hasApi
    },

    cameras: {
      total: deviceCameras.length,
      online: onlineCameras.length,
      offline: offlineCameras.length
    },

    media: {
      streams,
      resolutions: [
        ...new Set(
          deviceCameras
            .map(camera => camera.resolution)
            .filter(Boolean)
        )
      ]
    },

    diagnosis: {
      deviceStatus:
        device.status === 'online' ? 'OK' : 'ATTENTION',

      cameraStatus:
        offlineCameras.length === 0 ? 'OK' : 'ATTENTION',

      integrationStatus:
        hasOnvif || hasRtsp || hasApi ? 'CONFIGURED' : 'UNKNOWN',

      networkTest: 'NOT_EXECUTED',

      message:
        'Diagnóstico baseado na configuração cadastrada. Teste real de rede ainda não executado.'
    }
  };
}
