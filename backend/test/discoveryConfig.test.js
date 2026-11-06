
import {
  test,
  afterEach
} from 'node:test';

import assert from 'node:assert/strict';

import {
  createDatabase
} from '../src/database/database.js';

import {
  buildApp
} from '../src/app.js';

const JWT_SECRET = 'a'.repeat(64);

const applications = [];

afterEach(async () => {
  while (applications.length > 0) {
    const application = applications.pop();

    await application.app.close().catch(() => {});
    application.db.close();
  }
});

async function createApplication(options = {}) {
  const db = createDatabase(':memory:');

  const discoveryService = {
    getLocalIPv4Addresses: () => [],
    discoverNetwork: async () => ({
      mode: 'LOCAL_NETWORK',
      network: '192.168.1.0/24',
      scannedHostCount: 254,
      respondingHostCount: 0,
      devices: []
    })
  };

  let app;

  try {
    app = await buildApp({
      db,
      logger: false,
      jwtSecret: JWT_SECRET,
      discoveryService,
      ...options
    });

    await app.ready();

    applications.push({
      app,
      db
    });

    const userResult = db.prepare(`
      INSERT INTO users (
        email,
        passwordHash,
        role,
        status
      )
      VALUES (?, ?, ?, ?)
    `).run(
      `superadmin-${applications.length}@config.test`,
      'hash-nao-utilizado',
      'superadmin',
      'active'
    );

    const token = app.jwt.sign({
      sub: String(userResult.lastInsertRowid),
      role: 'superadmin'
    });

    return {
      app,
      headers: {
        authorization: `Bearer ${token}`
      }
    };
  } catch (error) {
    if (app) {
      await app.close().catch(() => {});
    }

    db.close();

    throw error;
  }
}

test(
  'Configuração padrão deve bloquear nova varredura por 30 segundos',
  async () => {
    const { app, headers } = await createApplication();

    const firstResponse = await app.inject({
      method: 'POST',
      url: '/api/discovery/scan',
      headers,
      payload: {
        cidr: '192.168.1.0/24'
      }
    });

    assert.equal(firstResponse.statusCode, 200);

    const secondResponse = await app.inject({
      method: 'POST',
      url: '/api/discovery/scan',
      headers,
      payload: {
        cidr: '192.168.1.0/24'
      }
    });

    assert.equal(secondResponse.statusCode, 429);

    assert.ok(
      Number(secondResponse.headers['retry-after']) >= 1
    );
  }
);

test(
  'Configuração zero deve permitir varreduras consecutivas',
  async () => {
    const { app, headers } = await createApplication({
      scanCooldownMs: 0
    });

    const firstResponse = await app.inject({
      method: 'POST',
      url: '/api/discovery/scan',
      headers,
      payload: {
        cidr: '192.168.1.0/24'
      }
    });

    const secondResponse = await app.inject({
      method: 'POST',
      url: '/api/discovery/scan',
      headers,
      payload: {
        cidr: '192.168.1.0/24'
      }
    });

    assert.equal(firstResponse.statusCode, 200);
    assert.equal(secondResponse.statusCode, 200);
  }
);

test(
  'Aplicação deve rejeitar intervalo de varredura inválido',
  async () => {
    const invalidValues = [
      -1,
      300001,
      1.5,
      '30000'
    ];

    for (const value of invalidValues) {
      const db = createDatabase(':memory:');

      try {
        await assert.rejects(
          () => buildApp({
            db,
            logger: false,
            jwtSecret: JWT_SECRET,
            scanCooldownMs: value
          }),
          /Intervalo entre varreduras inválido/
        );
      } finally {
        db.close();
      }
    }
  }
);
