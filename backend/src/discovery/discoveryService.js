
import os from 'node:os';

import {
  parseIPv4Cidr,
  listIPv4Hosts
} from './networkUtils.js';

import { scanHost } from './portScanner.js';
import { summarizeDevice } from './serviceIdentifier.js';

const MAX_HOSTS_PER_SCAN = 254;
const MAX_CONCURRENT_HOSTS = 10;
const DEFAULT_SCAN_TIMEOUT_MS = 120000;
const MAX_SCAN_TIMEOUT_MS = 300000;

function createAbortError() {
  const error = new Error('Varredura de rede cancelada.');
  error.name = 'AbortError';
  return error;
}

function createTimeoutError() {
  const error = new Error(
    'A varredura ultrapassou o tempo máximo permitido.'
  );

  error.name = 'TimeoutError';
  return error;
}

function getLocalIPv4Addresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const [interfaceName, entries] of Object.entries(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) {
        continue;
      }

      addresses.push({
        interfaceName,
        address: entry.address,
        netmask: entry.netmask,
        mac: entry.mac
      });
    }
  }

  return addresses;
}

function notifyProgress(callback, progress) {
  if (typeof callback !== 'function') {
    return;
  }

  try {
    callback({ ...progress });
  } catch {
    // Falhas no acompanhamento não interrompem a descoberta.
  }
}

async function mapWithConcurrency(
  items,
  concurrency,
  task,
  signal,
  onProgress
) {
  const results = new Array(items.length);

  let nextIndex = 0;
  let completedHosts = 0;
  let respondingHosts = 0;
  let failedHosts = 0;

  const progress = {
    totalHosts: items.length,
    completedHosts,
    respondingHosts,
    failedHosts
  };

  notifyProgress(onProgress, progress);

  async function worker() {
    while (true) {
      if (signal.aborted) {
        throw createAbortError();
      }

      const index = nextIndex++;

      if (index >= items.length) {
        return;
      }

      const host = items[index];

      try {
        const result = await task(host);

        results[index] = result;

        if (result.openPorts?.length > 0) {
          respondingHosts++;
        }
      } catch (error) {
        if (signal.aborted || error?.name === 'AbortError') {
          throw createAbortError();
        }

        failedHosts++;

        results[index] = {
          host,
          error: error?.message || 'Falha desconhecida.'
        };
      } finally {
        completedHosts++;

        progress.completedHosts = completedHosts;
        progress.respondingHosts = respondingHosts;
        progress.failedHosts = failedHosts;

        notifyProgress(onProgress, progress);
      }
    }
  }

  const workerCount = Math.min(
    concurrency,
    items.length
  );

  const workerResults = await Promise.allSettled(
    Array.from(
      { length: workerCount },
      () => worker()
    )
  );

  if (signal.aborted) {
    throw createAbortError();
  }

  const failedWorker = workerResults.find(
    result => result.status === 'rejected'
  );

  if (failedWorker) {
    throw failedWorker.reason;
  }

  return {
    results,
    completedHosts,
    respondingHosts,
    failedHosts
  };
}

async function discoverNetwork(
  cidr,
  {
    signal: externalSignal,
    timeoutMs = DEFAULT_SCAN_TIMEOUT_MS,
    onProgress,
    scanHost: scanHostImplementation = scanHost
  } = {}
) {
  if (
    !Number.isFinite(timeoutMs) ||
    timeoutMs < 1000 ||
    timeoutMs > MAX_SCAN_TIMEOUT_MS
  ) {
    throw new Error(
      `O tempo limite deve estar entre 1000 e ${MAX_SCAN_TIMEOUT_MS} milissegundos.`
    );
  }

  if (typeof scanHostImplementation !== 'function') {
    throw new Error('Implementação de scanner inválida.');
  }

  if (
    externalSignal !== undefined &&
    (
      typeof externalSignal !== 'object' ||
      externalSignal === null ||
      typeof externalSignal.aborted !== 'boolean' ||
      typeof externalSignal.addEventListener !== 'function' ||
      typeof externalSignal.removeEventListener !== 'function'
    )
  ) {
    throw new Error('Sinal de cancelamento inválido.');
  }

  if (externalSignal?.aborted) {
    throw createAbortError();
  }

  const startedAt = new Date().toISOString();
  const network = parseIPv4Cidr(cidr);

  if (!network.isPrivate) {
    throw new Error(
      'A descoberta aceita somente redes IPv4 privadas autorizadas.'
    );
  }

  if (network.hostCount > MAX_HOSTS_PER_SCAN) {
    throw new Error(
      `A varredura permite no máximo ${MAX_HOSTS_PER_SCAN} hosts.`
    );
  }

  const hosts = listIPv4Hosts(network);
  const controller = new AbortController();

  let timedOut = false;

  const abortFromCaller = () => {
    controller.abort();
  };

  if (externalSignal) {
    externalSignal.addEventListener(
      'abort',
      abortFromCaller,
      { once: true }
    );
  }

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const scan = await mapWithConcurrency(
      hosts,
      MAX_CONCURRENT_HOSTS,
      host => scanHostImplementation(host, {
        signal: controller.signal
      }),
      controller.signal,
      onProgress
    );

    if (timedOut) {
      throw createTimeoutError();
    }

    if (controller.signal.aborted) {
      throw createAbortError();
    }

    const devices = scan.results
      .filter(result => result.openPorts?.length > 0)
      .map(result => {
        const identification = summarizeDevice(
          result.openPorts
        );

        return {
          ip: result.host,
          connectionType: 'LOCAL_TCP_SCAN',
          status: 'RESPONDEU',
          openPorts: result.openPorts,
          checkedAt: result.checkedAt,
          ...identification
        };
      });

    return {
      mode: 'LOCAL_NETWORK',
      network: network.cidr,
      startedAt,
      finishedAt: new Date().toISOString(),
      scannedHostCount: scan.completedHosts,
      respondingHostCount: devices.length,
      failedHostCount: scan.failedHosts,
      devices,
      note: 'Esta operação testa portas TCP na rede privada informada. Não identifica necessariamente câmeras e não confirma acesso remoto, fabricante, vídeo ou compatibilidade.'
    };
  } catch (error) {
    if (timedOut) {
      throw createTimeoutError();
    }

    if (controller.signal.aborted) {
      throw createAbortError();
    }

    throw error;
  } finally {
    clearTimeout(timeout);

    if (externalSignal) {
      externalSignal.removeEventListener(
        'abort',
        abortFromCaller
      );
    }
  }
}

export {
  getLocalIPv4Addresses,
  discoverNetwork
};
