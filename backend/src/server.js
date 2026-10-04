import Fastify from 'fastify';

const app = Fastify({
  logger: true
});

app.get('/api/health', async () => {
  return {
    status: 'online',
    system: 'MultiCam',
    message: 'Backend funcionando'
  };
});

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