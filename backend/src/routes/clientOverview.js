
import {
  getClientOverview
} from '../services/clientService.js';

import {
  canAccessClient
} from '../services/authorizationService.js';

export default async function clientOverviewRoutes(app) {
  const db = app.db;
  const authenticate = app.authenticate;

  if (typeof authenticate !== 'function') {
    throw new Error(
      'Autenticação JWT não configurada para as rotas de resumo dos clientes.'
    );
  }

  // GET — visualizar resumo de um cliente autorizado
  app.get('/api/clients/:clientId/overview', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const clientId = Number(request.params.clientId);

    if (!Number.isSafeInteger(clientId) || clientId <= 0) {
      return reply.code(400).send({
        error: 'ID do cliente inválido'
      });
    }

    if (!canAccessClient(request.authUser, clientId)) {
      return reply.code(404).send({
        error: 'Cliente não encontrado'
      });
    }

    const overview = getClientOverview(db, clientId);

    if (!overview) {
      return reply.code(404).send({
        error: 'Cliente não encontrado'
      });
    }

    return overview;
  });
}
