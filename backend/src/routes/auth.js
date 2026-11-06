
import {
  verifyPassword
} from '../services/authService.js';

export default async function authRoutes(app, options = {}) {
  const db = app.db;

  const loginRateLimitTimeWindow =
    options.loginRateLimitTimeWindow ?? 60_000;

  if (
    !Number.isSafeInteger(loginRateLimitTimeWindow) ||
    loginRateLimitTimeWindow <= 0
  ) {
    throw new Error(
      'O intervalo do limitador de login deve ser um número inteiro positivo.'
    );
  }

  // POST — autenticar usuário
  app.post('/api/auth/login', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: loginRateLimitTimeWindow
      }
    }
  }, async (request, reply) => {
    const { email, password } = request.body ?? {};

    if (
      typeof email !== 'string' ||
      !email.trim() ||
      typeof password !== 'string' ||
      !password
    ) {
      return reply.code(400).send({
        error: 'E-mail e senha são obrigatórios.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = db.prepare(`
      SELECT
        id,
        email,
        passwordHash,
        role,
        status
      FROM users
      WHERE email = ? COLLATE NOCASE
    `).get(normalizedEmail);

    if (
      !user ||
      user.status !== 'active' ||
      !(await verifyPassword(password, user.passwordHash))
    ) {
      return reply.code(401).send({
        error: 'E-mail ou senha inválidos.'
      });
    }

    const token = app.jwt.sign({
      sub: String(user.id),
      role: user.role
    });

    return reply.code(200).send({
      message: 'Autenticação realizada com sucesso.',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  });
}
