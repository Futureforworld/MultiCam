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
  app.get('/api/clients', async () => {
    return {
      total: clients.length,
      clients
    };
  });
}