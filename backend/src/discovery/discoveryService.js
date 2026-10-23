
import os from 'node:os';

import {
  parseIPv4Cidr,
  listIPv4Hosts
} from './networkUtils.js';

import { scanHost } from './portScanner.js';
import { summarizeDevice } from './serviceIdentifier.js';

const MAX_HOSTS_PER_SCAN = 254;
const MAX_CONCURRENT_HOSTS = 10;

function getLocalIPv4Addresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const [interfaceName, entries] of Object.entries(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;

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

async function mapWithConcurrency(items, concurrency, task) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;

      if (index >= items.length) return;

      try {
        results[index] = await task(items[index]);
      } catch (error) {
        results[index] = {
          host: items[index],
          error: error.message
        };
      }
    }
  }

  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, () => worker())
  );

  return results;
}

async function discoverNetwork(cidr) {
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

  const results = await mapWithConcurrency(
    hosts,
    MAX_CONCURRENT_HOSTS,
    host => scanHost(host)
  );

  const devices = results
    .filter(result => result.openPorts?.length > 0)
    .map(result => {
      const identification = summarizeDevice(result.openPorts);

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
    scannedHostCount: hosts.length,
    respondingHostCount: devices.length,
    devices,
    note: 'Esta operação testa portas TCP na rede privada informada. Não identifica necessariamente câmeras e não confirma acesso remoto, fabricante, vídeo ou compatibilidade.'
  };
}

export {
  getLocalIPv4Addresses,
  discoverNetwork
};
