const clients = [
  {
    id: 1,
    name: 'Farmácia Central',
    status: 'online',
    cameras: 12
  },
  {
    id: 2,
    name: 'Padaria São José',
    status: 'online',
    cameras: 8
  },
  {
    id: 3,
    name: 'Mercado Bom Preço',
    status: 'attention',
    cameras: 16
  }
];

export default async function clientsRoutes(app) {

  // GET — listar todos os clientes
  app.get('/api/clients', async () => {
    return {
      total: clients.length,
      clients
    };
  });

  // POST — cadastrar um novo cliente
  app.post('/api/clients', async (request, reply) => {
    const {
      name,
      status = 'online',
      cameras = 0
    } = request.body;

    if (!name) {
      return reply.code(400).send({
        error: 'Nome do cliente é obrigatório'
      });
    }

    const newClient = {
      id: clients.length + 1,
      name,
      status,
      cameras
    };

    clients.push(newClient);

    return reply.code(201).send(newClient);
  });
}