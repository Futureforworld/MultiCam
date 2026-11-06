
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  mkdtempSync,
  rmSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createDatabase } from '../src/database/database.js';

function createTemporaryDatabase() {
  const directory = mkdtempSync(
    join(tmpdir(), 'multicam-database-test-')
  );

  const databasePath = join(directory, 'test.sqlite');

  return {
    databasePath,
    cleanup() {
      rmSync(directory, {
        recursive: true,
        force: true
      });
    }
  };
}

function insertBasicRecords(database) {
  const client = database.prepare(`
    INSERT INTO clients (name)
    VALUES (?)
  `).run('Cliente de teste');

  const device = database.prepare(`
    INSERT INTO devices (clientId, name)
    VALUES (?, ?)
  `).run(Number(client.lastInsertRowid), 'NVR de teste');

  return {
    clientId: Number(client.lastInsertRowid),
    deviceId: Number(device.lastInsertRowid)
  };
}

test('Banco deve criar todas as tabelas principais', (t) => {
  const database = createDatabase(':memory:');

  t.after(() => database.close());

  const tables = database.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
    ORDER BY name
  `).all().map(row => row.name);

  assert.ok(tables.includes('clients'));
  assert.ok(tables.includes('devices'));
  assert.ok(tables.includes('users'));
  assert.ok(tables.includes('user_clients'));
  assert.ok(tables.includes('cameras'));
});

test('Banco deve ativar as chaves estrangeiras', (t) => {
  const database = createDatabase(':memory:');

  t.after(() => database.close());

  const result = database.prepare(
    'PRAGMA foreign_keys'
  ).get();

  assert.equal(result.foreign_keys, 1);
});

test('Banco deve criar índices principais', (t) => {
  const database = createDatabase(':memory:');

  t.after(() => database.close());

  const indexes = database.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'index'
  `).all().map(row => row.name);

  assert.ok(indexes.includes('idx_devices_client_id'));
  assert.ok(indexes.includes('idx_cameras_client_id'));
  assert.ok(indexes.includes('idx_cameras_device_id'));
  assert.ok(indexes.includes('idx_user_clients_client_id'));
  assert.ok(indexes.includes('idx_users_role'));
});

test('SQLite deve rejeitar câmera com canal zero', (t) => {
  const database = createDatabase(':memory:');

  t.after(() => database.close());

  const { clientId, deviceId } = insertBasicRecords(database);

  assert.throws(() => {
    database.prepare(`
      INSERT INTO cameras (
        clientId,
        deviceId,
        name,
        channel
      )
      VALUES (?, ?, ?, ?)
    `).run(clientId, deviceId, 'Câmera inválida', 0);
  });
});

test('SQLite deve rejeitar câmera com PTZ inválido', (t) => {
  const database = createDatabase(':memory:');

  t.after(() => database.close());

  const { clientId, deviceId } = insertBasicRecords(database);

  assert.throws(() => {
    database.prepare(`
      INSERT INTO cameras (
        clientId,
        deviceId,
        name,
        channel,
        ptz
      )
      VALUES (?, ?, ?, ?, ?)
    `).run(clientId, deviceId, 'Câmera inválida', 1, 2);
  });
});

test('SQLite deve rejeitar câmera com áudio inválido', (t) => {
  const database = createDatabase(':memory:');

  t.after(() => database.close());

  const { clientId, deviceId } = insertBasicRecords(database);

  assert.throws(() => {
    database.prepare(`
      INSERT INTO cameras (
        clientId,
        deviceId,
        name,
        channel,
        audio
      )
      VALUES (?, ?, ?, ?, ?)
    `).run(clientId, deviceId, 'Câmera inválida', 1, 2);
  });
});

test('SQLite deve impedir câmeras duplicadas no mesmo canal', (t) => {
  const database = createDatabase(':memory:');

  t.after(() => database.close());

  const { clientId, deviceId } = insertBasicRecords(database);

  const insertCamera = database.prepare(`
    INSERT INTO cameras (
      clientId,
      deviceId,
      name,
      channel
    )
    VALUES (?, ?, ?, ?)
  `);

  insertCamera.run(
    clientId,
    deviceId,
    'Câmera 1',
    1
  );

  assert.throws(() => {
    insertCamera.run(
      clientId,
      deviceId,
      'Câmera duplicada',
      1
    );
  });
});

test('SQLite deve impedir vínculo entre clientes diferentes', (t) => {
  const database = createDatabase(':memory:');

  t.after(() => database.close());

  const firstClient = database.prepare(`
    INSERT INTO clients (name)
    VALUES (?)
  `).run('Cliente 1');

  const secondClient = database.prepare(`
    INSERT INTO clients (name)
    VALUES (?)
  `).run('Cliente 2');

  const device = database.prepare(`
    INSERT INTO devices (clientId, name)
    VALUES (?, ?)
  `).run(
    Number(firstClient.lastInsertRowid),
    'NVR do cliente 1'
  );

  assert.throws(() => {
    database.prepare(`
      INSERT INTO cameras (
        clientId,
        deviceId,
        name,
        channel
      )
      VALUES (?, ?, ?, ?)
    `).run(
      Number(secondClient.lastInsertRowid),
      Number(device.lastInsertRowid),
      'Câmera de outro cliente',
      1
    );
  });
});

test('Migração deve preservar registros existentes de câmeras', (t) => {
  const temporary = createTemporaryDatabase();

  const legacyDatabase = new DatabaseSync(
    temporary.databasePath
  );

  legacyDatabase.exec(`
    CREATE TABLE clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'online'
    );

    CREATE TABLE devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'NVR',
      manufacturer TEXT,
      model TEXT,
      channels INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'online',
      integration TEXT NOT NULL DEFAULT 'ONVIF',
      FOREIGN KEY (clientId) REFERENCES clients(id)
    );

    CREATE TABLE cameras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId INTEGER NOT NULL,
      deviceId INTEGER NOT NULL,
      name TEXT NOT NULL,
      channel INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'online',
      protocol TEXT NOT NULL DEFAULT 'ONVIF',
      stream TEXT NOT NULL DEFAULT 'H.265',
      resolution TEXT NOT NULL DEFAULT '4MP',
      ptz INTEGER NOT NULL DEFAULT 0,
      audio INTEGER NOT NULL DEFAULT 0
    );

    INSERT INTO clients (id, name)
    VALUES (1, 'Cliente legado');

    INSERT INTO devices (id, clientId, name)
    VALUES (1, 1, 'NVR legado');

    INSERT INTO cameras (
      id, clientId, deviceId, name, channel,
      status, protocol, stream, resolution, ptz, audio
    )
    VALUES (
      10, 1, 1, 'Câmera legada', 1,
      'online', 'ONVIF', 'H.265', '4MP', 1, 1
    );
  `);

  legacyDatabase.close();

  let database;

  t.after(() => {
    try {
      database?.close();
    } finally {
      temporary.cleanup();
    }
  });

  database = createDatabase(temporary.databasePath);

  const camera = database.prepare(`
    SELECT *
    FROM cameras
    WHERE id = ?
  `).get(10);

  assert.ok(camera);
  assert.equal(camera.clientId, 1);
  assert.equal(camera.deviceId, 1);
  assert.equal(camera.name, 'Câmera legada');
  assert.equal(camera.channel, 1);
  assert.equal(camera.protocol, 'ONVIF');
  assert.equal(camera.stream, 'H.265');
  assert.equal(camera.resolution, '4MP');
  assert.equal(camera.ptz, 1);
  assert.equal(camera.audio, 1);

  const foreignKeyErrors = database.prepare(
    'PRAGMA foreign_key_check'
  ).all();

  assert.equal(foreignKeyErrors.length, 0);
});

test('Banco em arquivo deve utilizar modo WAL', (t) => {
  const temporary = createTemporaryDatabase();

  let database;

  t.after(() => {
    try {
      database?.close();
    } finally {
      temporary.cleanup();
    }
  });

  database = createDatabase(temporary.databasePath);

  const result = database.prepare(
    'PRAGMA journal_mode'
  ).get();

  assert.equal(result.journal_mode, 'wal');
});

test('Migração inválida deve preservar a estrutura e os dados antigos', (t) => {
  const temporary = createTemporaryDatabase();

  let verificationDatabase;

  t.after(() => {
    try {
      verificationDatabase?.close();
    } finally {
      temporary.cleanup();
    }
  });

  const legacyDatabase = new DatabaseSync(
    temporary.databasePath
  );

  legacyDatabase.exec(`
    CREATE TABLE clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'online'
    );

    CREATE TABLE devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'NVR',
      manufacturer TEXT,
      model TEXT,
      channels INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'online',
      integration TEXT NOT NULL DEFAULT 'ONVIF',
      FOREIGN KEY (clientId) REFERENCES clients(id)
    );

    CREATE TABLE cameras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId INTEGER NOT NULL,
      deviceId INTEGER NOT NULL,
      name TEXT NOT NULL,
      channel INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'online',
      protocol TEXT NOT NULL DEFAULT 'ONVIF',
      stream TEXT NOT NULL DEFAULT 'H.265',
      resolution TEXT NOT NULL DEFAULT '4MP',
      ptz INTEGER NOT NULL DEFAULT 0,
      audio INTEGER NOT NULL DEFAULT 0
    );

    INSERT INTO clients (id, name)
    VALUES (1, 'Cliente legado');

    INSERT INTO cameras (
      id, clientId, deviceId, name, channel
    )
    VALUES (
      20, 1, 999, 'Câmera com dispositivo inexistente', 1
    );
  `);

  legacyDatabase.close();

  assert.throws(
    () => createDatabase(temporary.databasePath),
    /vínculos inconsistentes/i
  );

  verificationDatabase = new DatabaseSync(
    temporary.databasePath
  );

  const camera = verificationDatabase.prepare(`
    SELECT *
    FROM cameras
    WHERE id = 20
  `).get();

  assert.ok(camera);
  assert.equal(camera.deviceId, 999);
  assert.equal(
    camera.name,
    'Câmera com dispositivo inexistente'
  );

  const schema = verificationDatabase.prepare(`
    SELECT sql
    FROM sqlite_master
    WHERE type = 'table' AND name = 'cameras'
  `).get();

  assert.ok(schema);

  const normalizedSchema = schema.sql
    .replace(/\s+/g, '')
    .toLowerCase();

  assert.equal(
    normalizedSchema.includes('unique(deviceid,channel)'),
    false
  );

  assert.equal(
    normalizedSchema.includes(
      'foreignkey(deviceid,clientid)referencesdevices(id,clientid)'
    ),
    false
  );
});
