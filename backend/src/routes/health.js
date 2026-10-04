export default async function healthRoutes(app) {
  app.get('/api/health', async () => {
    return {
      status: 'online',
      system: 'MultiCam',
      message: 'Backend funcionando'
    };
  });
}