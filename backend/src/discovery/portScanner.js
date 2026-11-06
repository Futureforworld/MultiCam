
import net from 'node:net';

import {
  connectionLimiter
} from './connectionLimiter.js';

const DEFAULT_TIMEOUT_MS = 900;
const MAX_TIMEOUT_MS = 10000;
const MAX_CONCURRENT_TESTS = 20;

const CCTV_PORTS = [
  { port: 80, service: 'HTTP' },
  { port: 443, service: 'HTTPS' },
  { port: 554, service: 'RTSP' },
  { port: 8000, service: 'POSSIBLE_CCTV_SERVICE' },
  { port: 8080, service: 'HTTP_ALT' },
  { port: 8899, service: 'POSSIBLE_CCTV_SERVICE' },
  { port: 34567, service: 'POSSIBLE_CCTV_SERVICE' },
  { port: 37777, service: 'POSSIBLE_CCTV_SERVICE' }
];

function createAbortError() {
  const error = new Error('Operação de descoberta cancelada.');
  error.name = 'AbortError';
  return error;
}

function validateHost(host) {
  if (
    typeof host !== 'string' ||
    net.isIP(host) !== 4
  ) {
    throw new Error('Host IPv4 inválido.');
  }
}

function validatePort(port) {
  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error('Porta TCP inválida.');
  }
}

function validateTimeout(timeoutMs) {
  if (
    !Number.isFinite(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > MAX_TIMEOUT_MS
  ) {
    throw new Error(
      `Timeout inválido. Informe um valor maior que zero e até ${MAX_TIMEOUT_MS} ms.`
    );
  }
}

async function testPort(
  host,
  port,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  {
    signal,
    socketFactory = () => new net.Socket()
  } = {}
) {
  validateHost(host);
  validatePort(port);
  validateTimeout(timeoutMs);

  if (typeof socketFactory !== 'function') {
    throw new Error('Fábrica de socket inválida.');
  }

  return connectionLimiter.run(() => {
    return new Promise((resolve, reject) => {
      const socket = socketFactory();

      if (
        !socket ||
        typeof socket.once !== 'function' ||
        typeof socket.setTimeout !== 'function' ||
        typeof socket.destroy !== 'function' ||
        typeof socket.connect !== 'function'
      ) {
        reject(new Error('Socket inválido.'));
        return;
      }

      let finished = false;
      let result = false;
      let abortError = null;

      const cleanup = () => {
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
      };

      const finish = (isOpen, error = null) => {
        if (finished) return;

        finished = true;
        result = isOpen;
        abortError = error;

        socket.destroy();
      };

      const onAbort = () => {
        finish(false, createAbortError());
      };

      socket.once('close', () => {
        cleanup();

        if (abortError) {
          reject(abortError);
          return;
        }

        resolve(result);
      });

      if (signal) {
        if (signal.aborted) {
          finish(false, createAbortError());
          return;
        }

        signal.addEventListener('abort', onAbort, {
          once: true
        });
      }

      socket.setTimeout(timeoutMs);

      socket.once('connect', () => {
        finish(true);
      });

      socket.once('timeout', () => {
        finish(false);
      });

      socket.once('error', () => {
        finish(false);
      });

      socket.connect(port, host);
    });
  }, { signal });
}

async function mapWithConcurrency(
  items,
  concurrency,
  task,
  signal
) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      if (signal?.aborted) {
        throw createAbortError();
      }

      const index = nextIndex++;

      if (index >= items.length) return;

      results[index] = await task(items[index], index);
    }
  }

  const workerCount = Math.min(
    Math.max(1, concurrency),
    items.length
  );

  const workerPromises = Array.from(
    { length: workerCount },
    () => worker()
  );

  const settledWorkers = await Promise.allSettled(
    workerPromises
  );

  const failedWorker = settledWorkers.find(
    result => result.status === 'rejected'
  );

  if (failedWorker) {
    throw failedWorker.reason;
  }

  return results;
}

async function scanHost(
  host,
  {
    ports = CCTV_PORTS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal
  } = {}
) {
  validateHost(host);
  validateTimeout(timeoutMs);

  if (!Array.isArray(ports)) {
    throw new Error('Lista de portas inválida.');
  }

  for (const item of ports) {
    if (!item || typeof item !== 'object') {
      throw new Error('Configuração de porta inválida.');
    }

    validatePort(item.port);

    if (
      typeof item.service !== 'string' ||
      !item.service.trim()
    ) {
      throw new Error('Identificação do serviço inválida.');
    }
  }

  if (signal?.aborted) {
    throw createAbortError();
  }

  const results = await mapWithConcurrency(
    ports,
    MAX_CONCURRENT_TESTS,
    async item => {
      const isOpen = await testPort(
        host,
        item.port,
        timeoutMs,
        { signal }
      );

      return {
        port: item.port,
        service: item.service,
        state: isOpen ? 'OPEN' : 'CLOSED_OR_FILTERED'
      };
    },
    signal
  );

  return {
    host,
    checkedAt: new Date().toISOString(),
    ports: results,
    openPorts: results.filter(
      item => item.state === 'OPEN'
    )
  };
}

export {
  CCTV_PORTS,
  testPort,
  scanHost
};
