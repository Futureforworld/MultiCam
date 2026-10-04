import Fastify from 'fastify';
import healthRoutes from './routes/health.js';
import clientsRoutes from './routes/clients.js';

const app = Fastify({
  logger: true
});

await app.register(healthRoutes);
await app.register(clientsRoutes);

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