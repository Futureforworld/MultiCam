
import { db } from '../database/database.js';

export function getClientOverview(clientId) {
  const client = db.prepare(`
    SELECT id, name, status
    FROM clients
    WHERE id = ?
  `).get(clientId);

  if (!client) {
    return null;
  }

  const devices = db.prepare(`
    SELECT *
    FROM devices
    WHERE clientId = ?
    ORDER BY id
  `).all(clientId);

  const cameras = db.prepare(`
    SELECT *
    FROM cameras
    WHERE clientId = ?
    ORDER BY id
  `).all(clientId);

  return {
    client: {
      ...client,
      cameras: cameras.length
    },
    devices,
    cameras: cameras.map(camera => ({
      ...camera,
      ptz: Boolean(camera.ptz),
      audio: Boolean(camera.audio)
    }))
  };
}
