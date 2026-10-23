import { cameras } from '../data/store.js';

export default async function clientCamerasRoutes(app) {

  // GET — listar câmeras de um cliente
  app.get('/api/clients/:clientId/cameras', async (request) => {

    const clientId = Number(request.params.clientId);

    const clientCameras = cameras.filter(
      (camera) => camera.clientId === clientId
    );

    return {
      clientId,
      total: clientCameras.length,
      cameras: clientCameras
    };
  });
}