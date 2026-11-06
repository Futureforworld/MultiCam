
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import { buildApp } from '../src/app.js';
import { hashPassword } from '../src/services/authService.js';

const JWT_SECRET = 'a'.repeat(64);
const TEST_PASSWORD = 'MultiCamTeste2026!';

async function createTestEnvironment(options = {}) {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'online'
    );

    CREATE TABLE devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId INTEGER NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY (clientId) REFERENCES clients(id)
    );

    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE user_clients (
      userId INTEGER NOT NULL,
      clientId INTEGER NOT NULL,
      PRIMARY KEY (userId, clientId),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (clientId) REFERENCES clients(id)
    );

    CREATE TABLE cameras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deviceId INTEGER NOT NULL,
      clientId INTEGER NOT NULL,
      channel INTEGER NOT NULL,
      name TEXT,
      ptz INTEGER DEFAULT 0,
      audio INTEGER DEFAULT 0,
      FOREIGN KEY (deviceId) REFERENCES devices(id)
    );
  `);

  const passwordHash = await hashPassword(TEST_PASSWORD);

  db.prepare(`
    INSERT INTO users (email, passwordHash, role, status)
    VALUES (?, ?, ?, ?)
  `).run(
    'admin@multicam.test',
    passwordHash,
    'superadmin',
    'active'
  );

  db.prepare(`
    INSERT INTO users (email, passwordHash, role, status)
    VALUES (?, ?, ?, ?)
  `).run(
    'inativo@multicam.test',
    passwordHash,
    'admin',
    'disabled'
  );

  const app = await buildApp({
    db,
    logger: false,
    jwtSecret: JWT_SECRET,
    loginRateLimitTimeWindow: options.loginRateLimitTimeWindow
  });

  return { app, db };
}

test('Login aceita credenciais corretas e emite JWT válido', async (t) => {
  const { app, db } = await createTestEnvironment();

  t.after(async () => {
    await app.close();
    db.close();
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      email: 'admin@multicam.test',
      password: TEST_PASSWORD
    }
  });

  assert.equal(response.statusCode, 200);

  const body = response.json();

  assert.equal(body.user.email, 'admin@multicam.test');
  assert.equal(body.user.role, 'superadmin');
  assert.ok(body.token);

  const decoded = app.jwt.verify(body.token);

  assert.equal(decoded.sub, String(body.user.id));
  assert.equal(decoded.role, 'superadmin');
});

test('Login rejeita senha incorreta', async (t) => {
  const { app, db } = await createTestEnvironment();

  t.after(async () => {
    await app.close();
    db.close();
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      email: 'admin@multicam.test',
      password: 'SenhaErrada2026!'
    }
  });

  assert.equal(response.statusCode, 401);
  assert.equal(
    response.json().error,
    'E-mail ou senha inválidos.'
  );
});

test('Login rejeita usuário desativado', async (t) => {
  const { app, db } = await createTestEnvironment();

  t.after(async () => {
    await app.close();
    db.close();
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      email: 'inativo@multicam.test',
      password: TEST_PASSWORD
    }
  });

  assert.equal(response.statusCode, 401);
});

test('Login exige e-mail e senha', async (t) => {
  const { app, db } = await createTestEnvironment();

  t.after(async () => {
    await app.close();
    db.close();
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      email: '',
      password: ''
    }
  });

  assert.equal(response.statusCode, 400);
});

test('Login bloqueia a sexta tentativa dentro da janela de um minuto', async (t) => {
  const { app, db } = await createTestEnvironment();

  t.after(async () => {
    await app.close();
    db.close();
  });

  for (let attempt = 1; attempt <= 5; attempt++) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin@multicam.test',
        password: 'SenhaErrada2026!'
      }
    });

    assert.equal(response.statusCode, 401);
  }

  const sixthResponse = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      email: 'admin@multicam.test',
      password: 'SenhaErrada2026!'
    }
  });

  assert.equal(sixthResponse.statusCode, 429);

  assert.ok(
    Number(sixthResponse.headers['retry-after']) > 0
  );
});

test('Tentativas com senha correta também consomem o limite', async (t) => {
  const { app, db } = await createTestEnvironment();

  t.after(async () => {
    await app.close();
    db.close();
  });

  for (let attempt = 1; attempt <= 5; attempt++) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin@multicam.test',
        password: TEST_PASSWORD
      }
    });

    assert.equal(response.statusCode, 200);
  }

  const sixthResponse = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      email: 'admin@multicam.test',
      password: TEST_PASSWORD
    }
  });

  assert.equal(sixthResponse.statusCode, 429);
});

test('Bloqueio de login não deve bloquear outras rotas da API', async (t) => {
  const { app, db } = await createTestEnvironment();

  t.after(async () => {
    await app.close();
    db.close();
  });

  for (let attempt = 1; attempt <= 6; attempt++) {
    await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin@multicam.test',
        password: 'SenhaErrada2026!'
      }
    });
  }

  const healthResponse = await app.inject({
    method: 'GET',
    url: '/api/health'
  });

  assert.equal(healthResponse.statusCode, 200);
});

test('Bloqueio de login deve expirar após a janela configurada', async (t) => {
  const { app, db } = await createTestEnvironment({
    loginRateLimitTimeWindow: 1000
  });

  t.after(async () => {
    await app.close();
    db.close();
  });

  for (let attempt = 1; attempt <= 5; attempt++) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'admin@multicam.test',
        password: 'SenhaErrada2026!'
      }
    });

    assert.equal(response.statusCode, 401);
  }

  const blockedResponse = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      email: 'admin@multicam.test',
      password: 'SenhaErrada2026!'
    }
  });

  assert.equal(blockedResponse.statusCode, 429);

  await new Promise(resolve => setTimeout(resolve, 1200));

  const responseAfterExpiration = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      email: 'admin@multicam.test',
      password: 'SenhaErrada2026!'
    }
  });

  assert.equal(responseAfterExpiration.statusCode, 401);
});
