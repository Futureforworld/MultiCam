
import { db } from './database.js';

try {
  const clientCount = db
    .prepare('SELECT COUNT(*) AS total FROM clients')
    .get().total;

  const deviceCount = db
    .prepare('SELECT COUNT(*) AS total FROM devices')
    .get().total;

  const cameraCount = db
    .prepare('SELECT COUNT(*) AS total FROM cameras')
    .get().total;

  if (clientCount > 0 || deviceCount > 0 || cameraCount > 0) {
    console.log('Carga inicial ignorada: o banco já contém registros.');
  } else {
    db.exec('BEGIN');

    try {
      const insertClient = db.prepare(`
        INSERT INTO clients (id, name, status)
        VALUES (?, ?, ?)
      `);

      insertClient.run(1, 'Farmácia Central', 'online');
      insertClient.run(2, 'Padaria São José', 'online');
      insertClient.run(3, 'Mercado Bom Preço', 'attention');

      const insertDevice = db.prepare(`
        INSERT INTO devices (
          id, clientId, name, type, manufacturer, model,
          channels, status, integration
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertDevice.run(
        1, 1, 'NVR Farmácia Central', 'NVR',
        'Intelbras', 'NVD 1232', 32, 'online', 'ONVIF'
      );

      insertDevice.run(
        2, 2, 'NVR Padaria São José', 'NVR',
        'Hikvision', 'DS-7608', 8, 'online', 'ONVIF / RTSP'
      );

      insertDevice.run(
        3, 3, 'DVR Mercado Bom Preço', 'DVR',
        'Dahua', 'XVR', 16, 'attention', 'API / RTSP'
      );

      const insertCamera = db.prepare(`
        INSERT INTO cameras (
          id, clientId, deviceId, name, channel, status,
          protocol, stream, resolution, ptz, audio
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertCamera.run(
        1, 1, 1, 'Entrada Principal', 1, 'online',
        'ONVIF', 'H.265', '4MP', 0, 1
      );

      insertCamera.run(
        2, 1, 1, 'Caixa', 2, 'online',
        'ONVIF', 'H.265', '4MP', 0, 0
      );

      insertCamera.run(
        3, 2, 2, 'Área de Atendimento', 1, 'online',
        'RTSP', 'H.264', '2MP', 0, 1
      );

      insertCamera.run(
        4, 3, 3, 'Estacionamento', 1, 'attention',
        'API / RTSP', 'H.265', '4MP', 1, 0
      );

      db.exec('COMMIT');
      console.log('Carga inicial do MultiCam concluída.');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
} catch (error) {
  console.error('Erro na carga inicial:', error);
  process.exitCode = 1;
} finally {
  db.close();
}
