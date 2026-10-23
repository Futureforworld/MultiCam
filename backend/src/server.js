
import Fastify from 'fastify';
import cors from '@fastify/cors';

import healthRoutes from './routes/health.js';
import clientsRoutes from './routes/clients.js';
import devicesRoutes from './routes/devices.js';
import camerasRoutes from './routes/cameras.js';
import clientCamerasRoutes from './routes/clientCameras.js';
import clientOverviewRoutes from './routes/clientOverview.js';
import discoveryRoutes from './routes/discovery.js';

const app = Fastify({
  logger: true
});

await app.register(cors, {
  origin: true
});

await app.register(healthRoutes);
await app.register(clientsRoutes);
await app.register(devicesRoutes);
await app.register(camerasRoutes);
await app.register(clientCamerasRoutes);
await app.register(clientOverviewRoutes);
await app.register(discoveryRoutes);

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({
      port,
      host
    });

    app.log.info(`MultiCam Backend iniciado em ${host}:${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
