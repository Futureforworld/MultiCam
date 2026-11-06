
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

const successfulResult = {
  mode: 'LOCAL_NETWORK',
  network: '192.168.1.0/24',
  scannedHostCount: 254,
  respondingHostCount: 0,
  devices: []
};

async function createTestApplication(
  discoveryService,
  scanCooldownMs = 0
) {
  const db = createDatabase(':memory:');

  const superadminResult = db.prepare(`
    INSERT INTO users (
      email,
      passwordHash,
      role,
      status
    )
    VALUES (?, ?, ?, ?)
  `).run(
    'superadmin@discovery.test',
    'hash-nao-utilizado',
    'superadmin',
    'active'
  );

  const adminResult = db.prepare(`
    INSERT INTO users (
      email,
      passwordHash,
      role,
      status
    )
    VALUES (?, ?, ?, ?)
  `).run(
    'admin@discovery.test',
    'hash-nao-utilizado',
    'admin',
    'active'
  );

  const app = await buildApp({
    db,
    logger: false,
    jwtSecret: JWT_SECRET,
    discoveryService,
    scanCooldownMs
  });

  await app.ready();

  const superadminToken = app.jwt.sign({
    sub: String(superadminResult.lastInsertRowid),
    role: 'superadmin'
  });

  const adminToken = app.jwt.sign({
    sub: String(adminResult.lastInsertRowid),
    role: 'admin'
  });

  return {
    app,
    db,
    headers: {
      authorization: `Bearer ${superadminToken}`
    },
    adminHeaders: {
      authorization: `Bearer ${adminToken}`
    }
  };
}

const applications = [];

afterEach(async () => {
  while (applications.length > 0) {
    const application = applications.pop();

    await application.app.close();
    application.db.close();
  }
});

async function createApplication(
  discoveryService,
  scanCooldownMs = 0
) {
  const application = await createTestApplication(
    discoveryService,
    scanCooldownMs
  );

  applications.push(application);

  return application;
}

test(
  'Descoberta deve rejeitar rede pública sem executar o serviço',
  async () => {
    let discoveryCalls = 0;

    const discoveryService = {
      getLocalIPv4Addresses: () => [],
      discoverNetwork: async () => {
        discoveryCalls++;
        return successfulResult;
      }
    };

    const { app, headers } = await createApplication(
      discoveryService
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/discovery/scan',
      headers,
      payload: {
        cidr: '8.8.8.0/24'
      }
    });

    assert.equal(response.statusCode, 400);
    assert.equal(discoveryCalls, 0);
  }
);

test(
  'Descoberta deve rejeitar CIDR malformado sem executar o serviço',
  async () => {
    let discoveryCalls = 0;

    const discoveryService = {
      getLocalIPv4Addresses: () => [],
      discoverNetwork: async () => {
        discoveryCalls++;
        return successfulResult;
      }
    };

    const { app, headers } = await createApplication(
      discoveryService
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/discovery/scan',
      headers,
      payload: {
        cidr: '192.168.001.010/24'
      }
    });

    assert.equal(response.statusCode, 400);
    assert.equal(discoveryCalls, 0);
  }
);

test(
  'Descoberta deve rejeitar corpo que não seja objeto JSON',
  async () => {
    let discoveryCalls = 0;

    const discoveryService = {
      getLocalIPv4Addresses: () => [],
      discoverNetwork: async () => {
        discoveryCalls++;
        return successfulResult;
      }
    };

    const { app, headers } = await createApplication(
      discoveryService
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/discovery/scan',
      headers,
      payload: []
    });

    assert.equal(response.statusCode, 400);
    assert.equal(discoveryCalls, 0);
  }
);

test(
  'Descoberta deve rejeitar uma segunda varredura simultânea',
  async () => {
    let resolveScan;
    let notifyScanStarted;

    const scanStarted = new Promise(resolve => {
      notifyScanStarted = resolve;
    });

    const discoveryService = {
      getLocalIPv4Addresses: () => [],

      discoverNetwork: () => {
        notifyScanStarted();

        return new Promise(resolve => {
          resolveScan = resolve;
        });
      }
    };

    const { app, headers } = await createApplication(
      discoveryService
    );

    const firstScan = app.inject({
      method: 'POST',
      url: '/api/discovery/scan',
      headers,
      payload: {
        cidr: '192.168.1.0/24'
      }
    });

    await scanStarted;

    const secondScan = await app.inject({
      method: 'POST',
      url: '/api/discovery/scan',
      headers,
      payload: {
        cidr: '192.168.1.0/24'
      }
    });

    assert.equal(secondScan.statusCode, 409);

    resolveScan(successfulResult);

    const firstResponse = await firstScan;

    assert.equal(firstResponse.statusCode, 200);
  }
);

test(
  'Descoberta deve liberar o controle após falha inesperada',
  async () => {
    let discoveryCalls = 0;

    const discoveryService = {
      getLocalIPv4Addresses: () => [],

      discoverNetwork: async () => {
        discoveryCalls++;

        if (discoveryCalls === 1) {
          throw new Error('Falha simulada de teste.');
        }

        return successfulResult;
      }
    };

    const { app, headers } = await createApplication(
      discoveryService
    );

    const firstResponse = await app.inject({
      method: 'POST',
      url: '/api/discovery/scan',
      headers,
      payload: {
        cidr: '192.168.1.0/24'
      }
    });

    assert.equal(firstResponse.statusCode, 500);
    assert.equal(
      firstResponse.json().error,
      'Não foi possível concluir a descoberta de rede.'
    );

    const secondResponse = await app.inject({
      method: 'POST',
      url: '/api/discovery/scan',
      headers,
      payload: {
        cidr: '192.168.1.0/24'
      }
    });

    assert.equal(secondResponse.statusCode, 200);
    assert.equal(discoveryCalls, 2);
  }
);

test(
  'Status deve manter somente o resumo da varredura',
  async () => {
    const device = {
      host: '192.168.1.10',
      openPorts: [80, 554],
      services: ['HTTP', 'RTSP']
    };

    const scanResult = {
      mode: 'LOCAL_NETWORK',
      network: '192.168.1.0/24',
      scannedHostCount: 254,
      respondingHostCount: 1,
      failedHostCount: 0,
      devices: [device]
    };

    const discoveryService = {
      getLocalIPv4Addresses: () => [],
      discoverNetwork: async () => scanResult
    };

    const { app, headers } = await createApplication(
      discoveryService
    );

    const scanResponse = await app.inject({
      method: 'POST',
      url: '/api/discovery/scan',
      headers,
      payload: {
        cidr: '192.168.1.0/24'
      }
    });

    assert.equal(scanResponse.statusCode, 200);

    const scanBody = scanResponse.json();

    assert.deepEqual(scanBody.devices, [device]);

    const statusResponse = await app.inject({
      method: 'GET',
      url: '/api/discovery/status',
      headers
    });

    assert.equal(statusResponse.statusCode, 200);

    const statusBody = statusResponse.json();

    assert.equal(statusBody.status, 'COMPLETED');
    assert.equal(statusBody.scanInProgress, false);
    assert.equal(statusBody.scanExecuted, true);

    assert.equal(
      statusBody.scan.scannedHostCount,
      254
    );

    assert.equal(
      statusBody.scan.respondingHostCount,
      1
    );

    assert.equal(
      statusBody.scan.failedHostCount,
      0
    );

    assert.equal(
      Object.hasOwn(statusBody.scan, 'result'),
      false
    );

    assert.equal(
      Object.hasOwn(statusBody.scan, 'devices'),
      false
    );
  }
);

test(
  'Intervalo deve bloquear nova varredura após conclusão',
  async () => {
    let discoveryCalls = 0;

    const discoveryService = {
      getLocalIPv4Addresses: () => [],

      discoverNetwork: async () => {
        discoveryCalls++;
        return successfulResult;
      }
    };

    const { app, headers } = await createApplication(
      discoveryService,
      60_000
    );

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

    assert.equal(
      secondResponse.json().error,
      'Aguarde antes de iniciar outra varredura.'
    );

    assert.equal(discoveryCalls, 1);
  }
);

test(
  'Intervalo deve ser aplicado mesmo após falha',
  async () => {
    let discoveryCalls = 0;

    const discoveryService = {
      getLocalIPv4Addresses: () => [],

      discoverNetwork: async () => {
        discoveryCalls++;
        throw new Error('Falha simulada.');
      }
    };

    const { app, headers } = await createApplication(
      discoveryService,
      60_000
    );

    const firstResponse = await app.inject({
      method: 'POST',
      url: '/api/discovery/scan',
      headers,
      payload: {
        cidr: '192.168.1.0/24'
      }
    });

    assert.equal(firstResponse.statusCode, 500);

    const secondResponse = await app.inject({
      method: 'POST',
      url: '/api/discovery/scan',
      headers,
      payload: {
        cidr: '192.168.1.0/24'
      }
    });

    assert.equal(secondResponse.statusCode, 429);
    assert.equal(discoveryCalls, 1);
  }
);

test(
  'Intervalo deve ser aplicado mesmo após cancelamento',
  async () => {
    let notifyScanStarted;

    const scanStarted = new Promise(resolve => {
      notifyScanStarted = resolve;
    });

    const discoveryService = {
      getLocalIPv4Addresses: () => [],

      discoverNetwork: (cidr, { signal }) => {
        notifyScanStarted();

        return new Promise((resolve, reject) => {
          const onAbort = () => {
            const error = new Error('Varredura cancelada pelo teste.');
            error.name = 'AbortError';
            reject(error);
          };

          if (signal.aborted) {
            onAbort();
            return;
          }

          signal.addEventListener('abort', onAbort, {
            once: true
          });
        });
      }
    };

    const { app, headers } = await createApplication(
      discoveryService,
      60_000
    );

    const firstScan = app.inject({
      method: 'POST',
      url: '/api/discovery/scan',
      headers,
      payload: {
        cidr: '192.168.1.0/24'
      }
    });

    await scanStarted;

    const cancelResponse = await app.inject({
      method: 'POST',
      url: '/api/discovery/cancel',
      headers
    });

    assert.equal(cancelResponse.statusCode, 200);

    const scanResponse = await firstScan;

    assert.equal(scanResponse.statusCode, 409);

    const secondResponse = await app.inject({
      method: 'POST',
      url: '/api/discovery/scan',
      headers,
      payload: {
        cidr: '192.168.1.0/24'
      }
    });

    assert.equal(secondResponse.statusCode, 429);
  }
);

test(
  'Cancelamento deve ser rejeitado quando não existe varredura ativa',
  async () => {
    const discoveryService = {
      getLocalIPv4Addresses: () => [],
      discoverNetwork: async () => successfulResult
    };

    const { app, headers } = await createApplication(
      discoveryService
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/discovery/cancel',
      headers
    });

    assert.equal(response.statusCode, 409);
    assert.equal(
      response.json().error,
      'Não existe uma varredura em andamento.'
    );
  }
);

test(
  'Administrador comum não pode cancelar uma varredura',
  async () => {
    let notifyScanStarted;
    let resolveScan;

    const scanStarted = new Promise(resolve => {
      notifyScanStarted = resolve;
    });

    const discoveryService = {
      getLocalIPv4Addresses: () => [],

      discoverNetwork: () => {
        notifyScanStarted();

        return new Promise(resolve => {
          resolveScan = resolve;
        });
      }
    };

    const {
      app,
      headers,
      adminHeaders
    } = await createApplication(discoveryService);

    const firstScan = app.inject({
      method: 'POST',
      url: '/api/discovery/scan',
      headers,
      payload: {
        cidr: '192.168.1.0/24'
      }
    });

    await scanStarted;

    const cancelResponse = await app.inject({
      method: 'POST',
      url: '/api/discovery/cancel',
      headers: adminHeaders
    });

    assert.equal(cancelResponse.statusCode, 403);

    resolveScan(successfulResult);

    const scanResponse = await firstScan;

    assert.equal(scanResponse.statusCode, 200);
  }
);

test(
  'Superadmin deve conseguir cancelar uma varredura ativa',
  async () => {
    let notifyScanStarted;

    const scanStarted = new Promise(resolve => {
      notifyScanStarted = resolve;
    });

    const discoveryService = {
      getLocalIPv4Addresses: () => [],

      discoverNetwork: (cidr, { signal }) => {
        notifyScanStarted();

        return new Promise((resolve, reject) => {
          const onAbort = () => {
            const error = new Error('Varredura cancelada pelo teste.');
            error.name = 'AbortError';
            reject(error);
          };

          if (signal.aborted) {
            onAbort();
            return;
          }

          signal.addEventListener('abort', onAbort, {
            once: true
          });
        });
      }
    };

    const { app, headers } = await createApplication(
      discoveryService
    );

    const firstScan = app.inject({
      method: 'POST',
      url: '/api/discovery/scan',
      headers,
      payload: {
        cidr: '192.168.1.0/24'
      }
    });

    await scanStarted;

    const cancelResponse = await app.inject({
      method: 'POST',
      url: '/api/discovery/cancel',
      headers
    });

    assert.equal(cancelResponse.statusCode, 200);

    const cancelBody = cancelResponse.json();

    assert.equal(
      cancelBody.message,
      'Solicitação de cancelamento enviada.'
    );

    assert.ok(cancelBody.scanId);

    const scanResponse = await firstScan;

    assert.equal(scanResponse.statusCode, 409);
    assert.equal(
      scanResponse.json().error,
      'A varredura foi cancelada.'
    );

    const statusResponse = await app.inject({
      method: 'GET',
      url: '/api/discovery/status',
      headers
    });

    assert.equal(statusResponse.statusCode, 200);
    assert.equal(statusResponse.json().status, 'CANCELLED');
    assert.equal(statusResponse.json().scanInProgress, false);
    assert.equal(statusResponse.json().scanExecuted, true);
  }
);
