import Fastify from 'fastify';
import healthRoutes from './routes/health.js';
import clientsRoutes from './routes/clients.js';
import devicesRoutes from './routes/devices.js';
import camerasRoutes from './routes/cameras.js';
import clientCamerasRoutes from './routes/clientCameras.js';

const app = Fastify({
  logger: true
});

await app.register(healthRoutes);
await app.register(clientsRoutes);
await app.register(devicesRoutes);
await app.register(camerasRoutes);
await app.register(clientCamerasRoutes);

const start = async () => {
  try {
    await app.listen({
      port: 3000,
      host: '127.0.0.1'
    });

    console.log('MultiCam Backend iniciado em http://127.0.0.1:3000');
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();