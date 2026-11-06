
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = dirname(fileURLToPath(import.meta.url));

const defaultDatabasePath = join(
  currentDirectory,
  '../../data/multicam.sqlite'
);

function createTables(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'online'
    );

    CREATE TABLE IF NOT EXISTS devices (
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

    CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_id_client_id
    ON devices(id, clientId);

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL
        CHECK (role IN ('superadmin', 'admin', 'operator')),
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'disabled')),
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_clients (
      userId INTEGER NOT NULL,
      clientId INTEGER NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      PRIMARY KEY (userId, clientId),

      FOREIGN KEY (userId)
        REFERENCES users(id)
        ON DELETE CASCADE,

      FOREIGN KEY (clientId)
        REFERENCES clients(id)
        ON DELETE CASCADE
    );
  `);
}

function createCamerasTable(database, tableName = 'cameras') {
  database.exec(`
    CREATE TABLE ${tableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId INTEGER NOT NULL,
      deviceId INTEGER NOT NULL,
      name TEXT NOT NULL,
      channel INTEGER NOT NULL CHECK (channel > 0),
      status TEXT NOT NULL DEFAULT 'online',
      protocol TEXT NOT NULL DEFAULT 'ONVIF',
      stream TEXT NOT NULL DEFAULT 'H.265',
      resolution TEXT NOT NULL DEFAULT '4MP',
      ptz INTEGER NOT NULL DEFAULT 0 CHECK (ptz IN (0, 1)),
      audio INTEGER NOT NULL DEFAULT 0 CHECK (audio IN (0, 1)),

      FOREIGN KEY (clientId)
        REFERENCES clients(id),

      FOREIGN KEY (deviceId, clientId)
        REFERENCES devices(id, clientId),

      UNIQUE (deviceId, channel)
    );
  `);
}

function migrateCamerasTable(database) {
  const table = database.prepare(`
    SELECT sql
    FROM sqlite_master
    WHERE type = 'table' AND name = 'cameras'
  `).get();

  if (!table) {
    createCamerasTable(database);
    return;
  }

  const normalizedSchema = table.sql
    .replace(/\s+/g, '')
    .toLowerCase();

  const hasUniqueChannel = normalizedSchema.includes(
    'unique(deviceid,channel)'
  );

  const hasCompositeForeignKey = normalizedSchema.includes(
    'foreignkey(deviceid,clientid)referencesdevices(id,clientid)'
  );

  const hasChannelCheck = normalizedSchema.includes(
    'check(channel>0)'
  );

  const hasPtzCheck = normalizedSchema.includes(
    'check(ptzin(0,1))'
  );

  const hasAudioCheck = normalizedSchema.includes(
    'check(audioin(0,1))'
  );

  if (
    hasUniqueChannel &&
    hasCompositeForeignKey &&
    hasChannelCheck &&
    hasPtzCheck &&
    hasAudioCheck
  ) {
    return;
  }

  console.log('Iniciando migração da tabela cameras...');

  database.exec('PRAGMA foreign_keys = OFF;');

  let transactionStarted = false;

  try {
    database.exec('BEGIN IMMEDIATE');
    transactionStarted = true;

    createCamerasTable(database, 'cameras_new');

    database.exec(`
      INSERT INTO cameras_new (
        id,
        clientId,
        deviceId,
        name,
        channel,
        status,
        protocol,
        stream,
        resolution,
        ptz,
        audio
      )
      SELECT
        id,
        clientId,
        deviceId,
        name,
        channel,
        status,
        protocol,
        stream,
        resolution,
        ptz,
        audio
      FROM cameras;
    `);

    database.exec(`
      DROP TABLE cameras;

      ALTER TABLE cameras_new
      RENAME TO cameras;
    `);

    // Verifica a integridade antes de confirmar a migração.
    const foreignKeyErrors = database
      .prepare('PRAGMA foreign_key_check')
      .all();

    if (foreignKeyErrors.length > 0) {
      throw new Error(
        'Foram encontrados vínculos inconsistentes no banco de dados.'
      );
    }

    database.exec('COMMIT');
    transactionStarted = false;

    console.log('Migração da tabela cameras concluída.');
  } catch (error) {
    if (transactionStarted) {
      try {
        database.exec('ROLLBACK');
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          'Falha na migração e também na reversão da transação.'
        );
      }
    }

    throw error;
  } finally {
    database.exec('PRAGMA foreign_keys = ON;');
  }
}

function createIndexes(database) {
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_devices_client_id
    ON devices(clientId);

    CREATE INDEX IF NOT EXISTS idx_cameras_client_id
    ON cameras(clientId);

    CREATE INDEX IF NOT EXISTS idx_cameras_device_id
    ON cameras(deviceId);

    CREATE INDEX IF NOT EXISTS idx_user_clients_client_id
    ON user_clients(clientId);

    CREATE INDEX IF NOT EXISTS idx_users_role
    ON users(role);
  `);
}

export function createDatabase(
  databasePath = process.env.MULTICAM_DB_PATH || defaultDatabasePath
) {
  if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const database = new DatabaseSync(databasePath);

  try {
    database.exec('PRAGMA foreign_keys = ON;');

    if (databasePath !== ':memory:') {
      database.exec('PRAGMA journal_mode = WAL;');
    }

    createTables(database);
    migrateCamerasTable(database);
    createIndexes(database);

    const foreignKeyErrors = database
      .prepare('PRAGMA foreign_key_check')
      .all();

    if (foreignKeyErrors.length > 0) {
      throw new Error(
        'Foram encontrados vínculos inconsistentes no banco de dados.'
      );
    }

    return database;
  } catch (error) {
    try {
      database.close();
    } catch (closeError) {
      throw new AggregateError(
        [error, closeError],
        'Falha ao inicializar e fechar o banco de dados.'
      );
    }

    throw error;
  }
}
