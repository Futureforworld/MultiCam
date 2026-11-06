
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createDatabase } from '../src/database/database.js';
import { buildApp } from '../src/app.js';

describe('MultiCam API', () => {
  let db;
  let app;
  let authHeaders;
  let adminHeaders;

  const JWT_SECRET = 'a'.repeat(64);

  before(async () => {
    db = createDatabase(':memory:');

    db.prepare(`
      INSERT INTO clients (name, status)
      VALUES (?, ?)
    `).run('Cliente de Teste', 'online');

    db.prepare(`
      INSERT INTO devices (
        clientId, name, type, channels, status, integration
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(1, 'NVR de Teste', 'NVR', 8, 'online', 'ONVIF');

    db.prepare(`
      INSERT INTO clients (name, status)
      VALUES (?, ?)
    `).run('Segundo Cliente', 'online');

    db.prepare(`
      INSERT INTO devices (
        clientId, name, type, channels, status, integration
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(2, 'NVR do Segundo Cliente', 'NVR', 8, 'online', 'ONVIF');

    db.prepare(`
      INSERT INTO cameras (
        clientId, deviceId, name, channel, status,
        protocol, stream, resolution, ptz, audio
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      1, 1, 'Câmera de Teste', 1, 'online',
      'ONVIF', 'H.265', '4MP', 0, 1
    );

    db.prepare(`
      INSERT INTO cameras (
        clientId, deviceId, name, channel, status,
        protocol, stream, resolution, ptz, audio
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      2, 2, 'Câmera do Segundo Cliente', 1, 'online',
      'ONVIF', 'H.265', '4MP', 0, 0
    );

    const superadminResult = db.prepare(`
      INSERT INTO users (
        email, passwordHash, role, status
      )
      VALUES (?, ?, ?, ?)
    `).run(
      'superadmin@teste.local',
      'hash-nao-utilizado-neste-teste',
      'superadmin',
      'active'
    );

    const adminResult = db.prepare(`
      INSERT INTO users (
        email, passwordHash, role, status
      )
      VALUES (?, ?, ?, ?)
    `).run(
      'admin@cliente1.teste.local',
      'hash-nao-utilizado-neste-teste',
      'admin',
      'active'
    );

    db.prepare(`
      INSERT INTO user_clients (userId, clientId)
      VALUES (?, ?)
    `).run(Number(adminResult.lastInsertRowid), 1);

    app = await buildApp({
      db,
      logger: false,
      jwtSecret: JWT_SECRET
    });

    await app.ready();

    const superadminToken = app.jwt.sign({
      sub: String(superadminResult.lastInsertRowid),
      role: 'superadmin'
    });

    authHeaders = {
      authorization: `Bearer ${superadminToken}`
    };

    const adminToken = app.jwt.sign({
      sub: String(adminResult.lastInsertRowid),
      role: 'admin'
    });

    adminHeaders = {
      authorization: `Bearer ${adminToken}`
    };
  });

  after(async () => {
    if (app) {
      await app.close();
    }

    if (db) {
      db.close();
    }
  });

  // TESTES GET

  test('GET /api/health deve retornar online', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health'
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().status, 'online');
  });

  test('GET /api/clients deve listar todos os clientes para superadmin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/clients',
      headers: authHeaders
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().total, 2);
    assert.equal(response.json().clients[0].name, 'Cliente de Teste');
    assert.equal(response.json().clients[0].cameras, 1);
  });

  test('GET /api/devices deve listar todos os dispositivos para superadmin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/devices',
      headers: authHeaders
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().total, 2);
    assert.equal(response.json().devices[0].name, 'NVR de Teste');
  });

  test('GET /api/cameras deve listar todas as câmeras para superadmin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/cameras',
      headers: authHeaders
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().total, 2);
    assert.equal(response.json().cameras[0].name, 'Câmera de Teste');
    assert.equal(response.json().cameras[0].audio, true);
  });

  test('GET /api/cameras deve rejeitar requisição sem token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/cameras'
    });

    assert.equal(response.statusCode, 401);
  });

  test('GET /api/clients/1/overview deve retornar visão geral', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/clients/1/overview',
      headers: authHeaders
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().client.name, 'Cliente de Teste');
    assert.equal(response.json().devices.length, 1);
    assert.equal(response.json().cameras.length, 1);
  });

  test('GET /api/clients/999/overview deve retornar 404', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/clients/999/overview',
      headers: authHeaders
    });

    assert.equal(response.statusCode, 404);
  });

  test('GET /api/clients/1/cameras deve retornar câmeras do cliente', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/clients/1/cameras',
      headers: authHeaders
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().total, 1);
  });

  test('GET /api/devices/1/diagnostics deve retornar diagnóstico', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/devices/1/diagnostics',
      headers: authHeaders
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().cameras.total, 1);
    assert.equal(response.json().diagnosis.networkTest, 'NOT_EXECUTED');
  });

  // TESTES DE AUTENTICAÇÃO

  test('GET /api/clients deve rejeitar requisição sem token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/clients'
    });

    assert.equal(response.statusCode, 401);
  });

  test('GET /api/clients/1/overview deve rejeitar requisição sem token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/clients/1/overview'
    });

    assert.equal(response.statusCode, 401);
  });

  test('GET /api/clients/1/cameras deve rejeitar requisição sem token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/clients/1/cameras'
    });

    assert.equal(response.statusCode, 401);
  });

  test('GET /api/discovery/interfaces deve rejeitar requisição sem token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/discovery/interfaces'
    });

    assert.equal(response.statusCode, 401);
  });

  test('GET /api/discovery/status deve rejeitar requisição sem token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/discovery/status'
    });

    assert.equal(response.statusCode, 401);
  });

  test('POST /api/discovery/scan deve rejeitar requisição sem token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/discovery/scan',
      payload: {
        cidr: '192.168.1.0/24'
      }
    });

    assert.equal(response.statusCode, 401);
  });

  // TESTES DE ISOLAMENTO ENTRE CLIENTES

  test('Admin deve visualizar somente o cliente autorizado', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/clients',
      headers: adminHeaders
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().total, 1);
    assert.equal(response.json().clients[0].id, 1);
    assert.equal(response.json().clients[0].name, 'Cliente de Teste');
  });

  test('Admin deve visualizar somente dispositivos do seu cliente', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/devices',
      headers: adminHeaders
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().total, 1);
    assert.equal(response.json().devices[0].clientId, 1);
  });

  test('Admin deve visualizar somente câmeras do seu cliente', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/cameras',
      headers: adminHeaders
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().total, 1);
    assert.equal(response.json().cameras[0].clientId, 1);
  });

  test('Admin deve acessar o resumo do próprio cliente', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/clients/1/overview',
      headers: adminHeaders
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().client.name, 'Cliente de Teste');
  });

  test('Admin não deve acessar o resumo de outro cliente', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/clients/2/overview',
      headers: adminHeaders
    });

    assert.equal(response.statusCode, 404);
  });

  test('Admin deve acessar as câmeras do próprio cliente', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/clients/1/cameras',
      headers: adminHeaders
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().total, 1);
  });

  test('Admin não deve acessar câmeras de outro cliente', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/clients/2/cameras',
      headers: adminHeaders
    });

    assert.equal(response.statusCode, 404);
  });

  test('Admin não deve acessar diagnóstico de dispositivo de outro cliente', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/devices/2/diagnostics',
      headers: adminHeaders
    });

    assert.equal(response.statusCode, 404);
  });

  test('Admin não deve acessar resumo de dispositivo de outro cliente', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/devices/2/overview',
      headers: adminHeaders
    });

    assert.equal(response.statusCode, 404);
  });

  // TESTES POST — CLIENTES

  test('POST /api/clients deve cadastrar um cliente', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/clients',
      headers: authHeaders,
      payload: {
        name: 'Novo Cliente'
      }
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.json().name, 'Novo Cliente');
    assert.equal(response.json().status, 'online');
    assert.equal(response.json().cameras, 0);
  });

  test('POST /api/clients deve rejeitar nome vazio', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/clients',
      headers: authHeaders,
      payload: {
        name: '   '
      }
    });

    assert.equal(response.statusCode, 400);
  });

  test('POST /api/clients deve rejeitar cadastro por admin comum', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/clients',
      headers: adminHeaders,
      payload: {
        name: 'Cliente não autorizado'
      }
    });

    assert.equal(response.statusCode, 403);
  });

  // TESTES POST — DISPOSITIVOS

  test('POST /api/devices deve cadastrar um dispositivo', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/devices',
      headers: authHeaders,
      payload: {
        clientId: 1,
        name: 'NVR Secundário',
        type: 'NVR',
        channels: 16,
        manufacturer: 'Intelbras',
        model: 'NVD Teste'
      }
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.json().name, 'NVR Secundário');
    assert.equal(response.json().channels, 16);
  });

  test('POST /api/devices deve rejeitar cliente inexistente', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/devices',
      headers: authHeaders,
      payload: {
        clientId: 999,
        name: 'NVR Inválido'
      }
    });

    assert.equal(response.statusCode, 400);
  });

  test('POST /api/devices deve rejeitar canais negativos', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/devices',
      headers: authHeaders,
      payload: {
        clientId: 1,
        name: 'NVR Inválido',
        channels: -5
      }
    });

    assert.equal(response.statusCode, 400);
  });

  test('POST /api/devices deve rejeitar clientId como texto', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/devices',
      headers: authHeaders,
      payload: {
        clientId: '1',
        name: 'NVR Inválido'
      }
    });

    assert.equal(response.statusCode, 400);
  });

  test('POST /api/devices deve rejeitar channels como texto', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/devices',
      headers: authHeaders,
      payload: {
        clientId: 1,
        name: 'NVR Inválido',
        channels: '8'
      }
    });

    assert.equal(response.statusCode, 400);
  });

  test('POST /api/devices deve rejeitar tipo vazio', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/devices',
      headers: authHeaders,
      payload: {
        clientId: 1,
        name: 'NVR Inválido',
        type: '   '
      }
    });

    assert.equal(response.statusCode, 400);
  });

  test('POST /api/devices deve rejeitar status inválido', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/devices',
      headers: authHeaders,
      payload: {
        clientId: 1,
        name: 'NVR Inválido',
        status: 'desconhecido'
      }
    });

    assert.equal(response.statusCode, 400);
  });

  test('POST /api/devices deve rejeitar integração vazia', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/devices',
      headers: authHeaders,
      payload: {
        clientId: 1,
        name: 'NVR Inválido',
        integration: '   '
      }
    });

    assert.equal(response.statusCode, 400);
  });

  test('POST /api/devices deve rejeitar fabricante com tipo inválido', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/devices',
      headers: authHeaders,
      payload: {
        clientId: 1,
        name: 'NVR Inválido',
        manufacturer: 123
      }
    });

    assert.equal(response.statusCode, 400);
  });

  test('POST /api/devices deve impedir admin de cadastrar dispositivo em outro cliente', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/devices',
      headers: adminHeaders,
      payload: {
        clientId: 2,
        name: 'NVR não autorizado',
        channels: 8
      }
    });

    assert.equal(response.statusCode, 403);
  });

  // TESTES POST — CÂMERAS

  test('POST /api/cameras deve cadastrar uma câmera', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/cameras',
      headers: authHeaders,
      payload: {
        clientId: 1,
        deviceId: 1,
        name: 'Câmera Secundária',
        channel: 2,
        protocol: 'ONVIF',
        stream: 'H.265',
        resolution: '4MP',
        ptz: true,
        audio: false
      }
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.json().name, 'Câmera Secundária');
    assert.equal(response.json().ptz, true);
    assert.equal(response.json().audio, false);
  });

  test('POST /api/cameras deve rejeitar requisição sem token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/cameras',
      payload: {
        clientId: 1,
        deviceId: 1,
        name: 'Câmera sem autorização',
        channel: 3
      }
    });

    assert.equal(response.statusCode, 401);
  });

  test('POST /api/cameras deve rejeitar dispositivo de outro cliente', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/cameras',
      headers: authHeaders,
      payload: {
        clientId: 1,
        deviceId: 2,
        name: 'Tentativa de acesso cruzado',
        channel: 2
      }
    });

    assert.equal(response.statusCode, 400);
    assert.equal(
      response.json().error,
      'O dispositivo não existe ou não pertence ao cliente informado'
    );
  });

  test('POST /api/cameras deve impedir admin de cadastrar câmera em outro cliente', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/cameras',
      headers: adminHeaders,
      payload: {
        clientId: 2,
        deviceId: 2,
        name: 'Câmera não autorizada',
        channel: 2
      }
    });

    assert.equal(response.statusCode, 403);
  });

  test('POST /api/cameras deve rejeitar canal zero', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/cameras',
      headers: authHeaders,
      payload: {
        clientId: 1,
        deviceId: 1,
        name: 'Câmera Inválida',
        channel: 0
      }
    });

    assert.equal(response.statusCode, 400);
  });

  test('POST /api/cameras deve rejeitar canal acima da capacidade', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/cameras',
      headers: authHeaders,
      payload: {
        clientId: 1,
        deviceId: 1,
        name: 'Câmera Canal Inválido',
        channel: 9
      }
    });

    assert.equal(response.statusCode, 400);
  });

  test('POST /api/cameras deve rejeitar canal duplicado', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/cameras',
      headers: authHeaders,
      payload: {
        clientId: 1,
        deviceId: 1,
        name: 'Câmera Duplicada',
        channel: 1
      }
    });

    assert.equal(response.statusCode, 409);
  });

  test('POST /api/cameras deve rejeitar protocolo inválido', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/cameras',
      headers: authHeaders,
      payload: {
        clientId: 1,
        deviceId: 1,
        name: 'Câmera Protocolo Inválido',
        channel: 3,
        protocol: 'PROTOCOLO_INVALIDO'
      }
    });

    assert.equal(response.statusCode, 400);
  });

  test('POST /api/cameras deve rejeitar resolução inválida', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/cameras',
      headers: authHeaders,
      payload: {
        clientId: 1,
        deviceId: 1,
        name: 'Câmera Resolução Inválida',
        channel: 3,
        resolution: '16MP'
      }
    });

    assert.equal(response.statusCode, 400);
  });

  test('POST /api/cameras deve rejeitar PTZ não booleano', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/cameras',
      headers: authHeaders,
      payload: {
        clientId: 1,
        deviceId: 1,
        name: 'Câmera PTZ Inválido',
        channel: 3,
        ptz: 'sim'
      }
    });

    assert.equal(response.statusCode, 400);
  });

  test('POST /api/cameras deve rejeitar áudio não booleano', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/cameras',
      headers: authHeaders,
      payload: {
        clientId: 1,
        deviceId: 1,
        name: 'Câmera Áudio Inválida',
        channel: 3,
        audio: 'sim'
      }
    });

    assert.equal(response.statusCode, 400);
  });

  // TESTES DE DESCOBERTA DE REDE

  test('Admin autenticado deve consultar interfaces de rede', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/discovery/interfaces',
      headers: adminHeaders
    });

    assert.equal(response.statusCode, 200);
    assert.ok(Array.isArray(response.json().interfaces));
  });

  test('Admin autenticado deve consultar status da descoberta', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/discovery/status',
      headers: adminHeaders
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().status, 'READY');
    assert.equal(response.json().scanExecuted, false);
  });

  test('Admin comum não pode executar varredura de rede', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/discovery/scan',
      headers: adminHeaders,
      payload: {
        cidr: '192.168.1.0/24'
      }
    });

    assert.equal(response.statusCode, 403);
  });

  test('Superadmin sem CIDR deve receber erro de validação', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/discovery/scan',
      headers: authHeaders,
      payload: {}
    });

    assert.equal(response.statusCode, 400);
  });

  // TESTES DE INTEGRIDADE DIRETA DO SQLITE

  test('SQLite deve bloquear câmera duplicada no mesmo canal', () => {
    assert.throws(
      () => {
        db.prepare(`
          INSERT INTO cameras (
            clientId, deviceId, name, channel
          )
          VALUES (?, ?, ?, ?)
        `).run(1, 1, 'Câmera Duplicada Direta', 1);
      },
      /UNIQUE constraint failed/
    );
  });

  test('SQLite deve bloquear câmera vinculada a dispositivo de outro cliente', () => {
    assert.throws(
      () => {
        db.prepare(`
          INSERT INTO cameras (
            clientId, deviceId, name, channel
          )
          VALUES (?, ?, ?, ?)
        `).run(2, 1, 'Câmera com Cliente Incorreto', 8);
      },
      /FOREIGN KEY constraint failed/
    );
  });

  // TESTES ADICIONAIS DE SEGURANÇA

  test('Aplicação deve rejeitar inicialização sem JWT_SECRET', async () => {
    await assert.rejects(
      () => buildApp({
        db,
        logger: false
      }),
      /JWT_SECRET ausente ou inválido/
    );
  });

  test('Aplicação deve rejeitar JWT_SECRET inválido', async () => {
    await assert.rejects(
      () => buildApp({
        db,
        logger: false,
        jwtSecret: 'segredo-invalido'
      }),
      /JWT_SECRET ausente ou inválido/
    );
  });

  test('CORS deve permitir origem expressamente autorizada', async () => {
    const allowedOrigin = 'https://painel.multicam.test';

    const corsApp = await buildApp({
      db,
      logger: false,
      jwtSecret: JWT_SECRET,
      corsOrigins: [allowedOrigin]
    });

    try {
      const response = await corsApp.inject({
        method: 'OPTIONS',
        url: '/api/health',
        headers: {
          origin: allowedOrigin,
          'access-control-request-method': 'GET'
        }
      });

      assert.equal(
        response.headers['access-control-allow-origin'],
        allowedOrigin
      );
    } finally {
      await corsApp.close();
    }
  });

  test('CORS deve bloquear origem não autorizada', async () => {
    const allowedOrigin = 'https://painel.multicam.test';
    const blockedOrigin = 'https://site-nao-autorizado.test';

    const corsApp = await buildApp({
      db,
      logger: false,
      jwtSecret: JWT_SECRET,
      corsOrigins: [allowedOrigin]
    });

    try {
      const response = await corsApp.inject({
        method: 'OPTIONS',
        url: '/api/health',
        headers: {
          origin: blockedOrigin,
          'access-control-request-method': 'GET'
        }
      });

      assert.equal(
        response.headers['access-control-allow-origin'],
        undefined
      );
    } finally {
      await corsApp.close();
    }
  });
});
