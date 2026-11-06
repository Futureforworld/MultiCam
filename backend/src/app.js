
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';

import healthRoutes from './routes/health.js';
import clientsRoutes from './routes/clients.js';
import devicesRoutes from './routes/devices.js';
import camerasRoutes from './routes/cameras.js';
import clientCamerasRoutes from './routes/clientCameras.js';
import clientOverviewRoutes from './routes/clientOverview.js';
import discoveryRoutes from './routes/discovery.js';
import authRoutes from './routes/auth.js';

import {
  getAuthenticatedUser
} from './services/authorizationService.js';

import {
  getLocalIPv4Addresses,
  discoverNetwork
} from './discovery/discoveryService.js';

export async function buildApp(options = {}) {
  if (!options.db) {
    throw new Error(
      'Banco de dados não informado ao criar a aplicação MultiCam.'
    );
  }

  const jwtSecret = options.jwtSecret;

  if (
    typeof jwtSecret !== 'string' ||
    jwtSecret.length !== 64 ||
    !/^[a-fA-F0-9]{64}$/.test(jwtSecret)
  ) {
    throw new Error(
      'JWT_SECRET ausente ou inválido. A aplicação não pode iniciar sem um segredo válido.'
    );
  }

  const database = options.db;

  const configuredOrigins =
    options.corsOrigins ?? process.env.CORS_ORIGINS ?? '';

  const allowedOrigins = Array.isArray(configuredOrigins)
    ? configuredOrigins.filter(
        origin => typeof origin === 'string' && origin.trim() !== ''
      )
    : String(configuredOrigins)
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);

  const discoveryService = options.discoveryService ?? {
    getLocalIPv4Addresses,
    discoverNetwork
  };

  if (
    typeof discoveryService.getLocalIPv4Addresses !== 'function' ||
    typeof discoveryService.discoverNetwork !== 'function'
  ) {
    throw new Error(
      'Serviço de descoberta inválido. Verifique suas implementações.'
    );
  }

  const app = Fastify({
    logger: options.logger ?? true
  });

  app.decorate('db', database);

  await app.register(cors, {
    origin: allowedOrigins.length > 0 ? allowedOrigins : false
  });

  await app.register(jwt, {
    secret: jwtSecret,
    sign: {
      expiresIn: '1h'
    }
  });

  await app.register(rateLimit, {
    global: false
  });

  app.decorateRequest('authUser', null);

  app.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({
        error: 'Token ausente, inválido ou expirado.'
      });
    }

    const user = getAuthenticatedUser(
      database,
      request.user.sub
    );

    if (!user) {
      return reply.code(401).send({
        error: 'Usuário inexistente ou desativado.'
      });
    }

    request.authUser = user;
  });

  await app.register(authRoutes, {
    loginRateLimitTimeWindow: options.loginRateLimitTimeWindow
  });

  await app.register(healthRoutes);
  await app.register(clientsRoutes);
  await app.register(devicesRoutes);
  await app.register(camerasRoutes);
  await app.register(clientCamerasRoutes);
  await app.register(clientOverviewRoutes);

  await app.register(discoveryRoutes, {
    discoveryService,
    scanCooldownMs: options.scanCooldownMs
  });

  return app;
}
