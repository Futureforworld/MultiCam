
import { db } from '../database/database.js';

export default async function clientsRoutes(app) {
  // GET — listar clientes com a quantidade real de câmeras cadastradas
  app.get('/api/clients', async () => {
    const clients = db.prepare(`
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

    return {
      total: clients.length,
      clients
    };
  });

  // POST — cadastrar cliente no SQLite
  app.post('/api/clients', async (request, reply) => {
    const { name, status = 'online' } = request.body ?? {};

    if (typeof name !== 'string' || !name.trim()) {
      return reply.code(400).send({
        error: 'Nome do cliente é obrigatório'
      });
    }

    const result = db.prepare(`
      INSERT INTO clients (name, status)
      VALUES (?, ?)
    `).run(name.trim(), status);

    const newClient = db.prepare(`
      SELECT
        id,
        name,
        status
      FROM clients
      WHERE id = ?
    `).get(Number(result.lastInsertRowid));

    return reply.code(201).send({
      ...newClient,
      cameras: 0
    });
  });
}
