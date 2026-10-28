
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = dirname(fileURLToPath(import.meta.url));

const dataDirectory = join(currentDirectory, '../../data');

mkdirSync(dataDirectory, { recursive: true });

const databasePath = join(dataDirectory, 'multicam.sqlite');

export const db = new DatabaseSync(databasePath);

db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

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

  CREATE TABLE IF NOT EXISTS cameras (
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
    audio INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (clientId) REFERENCES clients(id),
    FOREIGN KEY (deviceId) REFERENCES devices(id)
  );
`);

console.log(`MultiCam SQLite inicializado: ${databasePath}`);
