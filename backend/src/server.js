
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

import { buildApp } from './app.js';
import { createDatabase } from './database/database.js';

// Carrega o .env localizado na raiz do MultiCam
const environmentPath = fileURLToPath(
  new URL('../../.env', import.meta.url)
);

dotenv.config({
  path: environmentPath
});

let app;
let db;
let shuttingDown = false;

// Fecha os recursos, mesmo que um dos encerramentos apresente erro.
async function closeResources() {
  let closeError;

  if (app) {
    try {
      await app.close();
    } catch (error) {
      closeError = error;
    } finally {
      app = null;
    }
  }

  if (db) {
    try {
      db.close();
    } catch (error) {
      closeError ??= error;
    } finally {
      db = null;
    }
  }

  if (closeError) {
    throw closeError;
  }
}

// Encerramento controlado do servidor.
async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  const logger = app?.log;

  if (logger) {
    logger.info(`Sinal ${signal} recebido. Encerrando MultiCam...`);
  } else {
    console.log(`Sinal ${signal} recebido. Encerrando MultiCam...`);
  }

  try {
    await closeResources();

    if (logger) {
      logger.info('MultiCam encerrado corretamente.');
    } else {
      console.log('MultiCam encerrado corretamente.');
    }
  } catch (error) {
    if (logger) {
      logger.error(error, 'Erro durante o encerramento do MultiCam.');
    } else {
      console.error('Erro durante o encerramento do MultiCam:', error);
    }

    process.exitCode = 1;
  }
}

// Valida a porta configurada no ambiente.
function getPort() {
  const configuredPort = process.env.PORT;

  if (
    configuredPort === undefined ||
    configuredPort.trim() === ''
  ) {
    return 3000;
  }

  const port = Number(configuredPort);

  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error(
      'PORT inválida. Informe um número inteiro entre 1 e 65535.'
    );
  }

  return port;
}

async function start() {
  try {
    const jwtSecret = process.env.JWT_SECRET;

    if (
      typeof jwtSecret !== 'string' ||
      !/^[a-fA-F0-9]{64}$/.test(jwtSecret)
    ) {
      throw new Error(
        'JWT_SECRET ausente ou inválido. Verifique o arquivo .env.'
      );
    }

    const port = getPort();
    const host = process.env.HOST?.trim() || '0.0.0.0';
    const corsOrigins = process.env.CORS_ORIGINS || '';

    db = createDatabase();

    console.log('MultiCam SQLite inicializado.');
    console.log('Configuração JWT carregada.');
    console.log('Configuração CORS carregada.');

    app = await buildApp({
      db,
      jwtSecret,
      corsOrigins
    });

    await app.listen({
      port,
      host
    });

    app.log.info(
      `MultiCam Backend iniciado em ${host}:${port}`
    );
  } catch (error) {
    if (app) {
      app.log.error(error);
    } else {
      console.error(error);
    }

    try {
      await closeResources();
    } catch (closeError) {
      console.error(
        'Erro ao liberar recursos durante a inicialização:',
        closeError
      );
    }

    process.exitCode = 1;
  }
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

start();
