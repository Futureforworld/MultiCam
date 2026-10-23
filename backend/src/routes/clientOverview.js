import { getClientOverview } from '../services/clientService.js';

export default async function clientOverviewRoutes(app) {

  app.get('/api/clients/:clientId/overview', async (request, reply) => {

    const clientId = Number(request.params.clientId);

    const overview = getClientOverview(clientId);

    if (!overview) {
      return reply.code(404).send({
        error: 'Cliente não encontrado'
      });
    }

    return overview;
  });
}