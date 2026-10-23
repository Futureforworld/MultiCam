import { clients, cameras } from '../data/store.js';

export default async function clientsRoutes(app) {

  // GET — listar todos os clientes
  app.get('/api/clients', async () => {

    const clientsWithCameraCount = clients.map(client => {

      const clientCameras = cameras.filter(
        camera => camera.clientId === client.id
      );

      return {
        ...client,
        cameras: clientCameras.length
      };
    });

    return {
      total: clientsWithCameraCount.length,
      clients: clientsWithCameraCount
    };
  });


  // POST — cadastrar um novo cliente
  app.post('/api/clients', async (request, reply) => {

    const {
      name,
      status = 'online'
    } = request.body;

    if (!name) {
      return reply.code(400).send({
        error: 'Nome do cliente é obrigatório'
      });
    }

    const newClient = {
      id: clients.length + 1,
      name,
      status
    };

    clients.push(newClient);

    return reply.code(201).send({
      ...newClient,
      cameras: 0
    });
  });
}