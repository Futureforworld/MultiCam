
export default async function clientsRoutes(app) {
  const db = app.db;
  const authenticate = app.authenticate;

  if (typeof authenticate !== 'function') {
    throw new Error(
      'Autenticação JWT não configurada para as rotas de clientes.'
    );
  }

  // GET — listar somente clientes autorizados
  app.get('/api/clients', {
    preHandler: [authenticate]
  }, async (request) => {
    const user = request.authUser;
    let clients;

    if (user.role === 'superadmin') {
      clients = db.prepare(`
        SELECT
          clients.id,
          clients.name,
          clients.status,
          COUNT(cameras.id) AS cameras
        FROM clients
        LEFT JOIN cameras ON cameras.clientId = clients.id
        GROUP BY clients.id, clients.name, clients.status
        ORDER BY clients.id
      `).all();
    } else {
      clients = db.prepare(`
        SELECT
          clients.id,
          clients.name,
          clients.status,
          COUNT(cameras.id) AS cameras
        FROM clients
        INNER JOIN user_clients
          ON user_clients.clientId = clients.id
        LEFT JOIN cameras
          ON cameras.clientId = clients.id
        WHERE user_clients.userId = ?
        GROUP BY clients.id, clients.name, clients.status
        ORDER BY clients.id
      `).all(user.id);
    }

    return {
      total: clients.length,
      clients
    };
  });

  // POST — somente superadministrador pode cadastrar clientes
  app.post('/api/clients', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const user = request.authUser;

    if (user.role !== 'superadmin') {
      return reply.code(403).send({
        error: 'Apenas o superadministrador pode cadastrar clientes.'
      });
    }

    const { name, status = 'online' } = request.body ?? {};

    if (typeof name !== 'string' || !name.trim()) {
      return reply.code(400).send({
        error: 'Nome do cliente é obrigatório'
      });
    }

    const allowedStatuses = ['online', 'offline', 'attention'];

    if (!allowedStatuses.includes(status)) {
      return reply.code(400).send({
        error: 'Status do cliente inválido'
      });
    }

    const result = db.prepare(`
      INSERT INTO clients (name, status)
      VALUES (?, ?)
    `).run(name.trim(), status);

    const newClient = db.prepare(`
      SELECT id, name, status
      FROM clients
      WHERE id = ?
    `).get(Number(result.lastInsertRowid));

    return reply.code(201).send({
      ...newClient,
      cameras: 0
    });
  });
}
