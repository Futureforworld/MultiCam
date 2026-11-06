
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  discoverNetwork
} from '../src/discovery/discoveryService.js';

function createSuccessfulScanner() {
  return async host => ({
    host,
    checkedAt: new Date().toISOString(),
    openPorts: host.endsWith('.1')
      ? [{ port: 554, service: 'RTSP', state: 'OPEN' }]
      : []
  });
}

function createAbortableScanner(onStarted = () => {}) {
  return (host, { signal }) => new Promise((resolve, reject) => {
    onStarted(host);

    const abort = () => {
      const error = new Error('Scanner cancelado.');
      error.name = 'AbortError';
      reject(error);
    };

    if (signal.aborted) {
      abort();
      return;
    }

    signal.addEventListener('abort', abort, { once: true });
  });
}

test('deve descobrir uma rede privada e retornar os resultados', async () => {
  const result = await discoverNetwork('192.168.1.0/30', {
    scanHost: createSuccessfulScanner()
  });

  assert.equal(result.mode, 'LOCAL_NETWORK');
  assert.equal(result.network, '192.168.1.0/30');
  assert.equal(result.scannedHostCount, 2);
  assert.equal(result.respondingHostCount, 1);
  assert.equal(result.failedHostCount, 0);
  assert.equal(result.devices.length, 1);
  assert.equal(result.devices[0].ip, '192.168.1.1');
  assert.equal(result.devices[0].connectionType, 'LOCAL_TCP_SCAN');
  assert.equal(result.devices[0].status, 'RESPONDEU');
  assert.ok(result.startedAt);
  assert.ok(result.finishedAt);
});

test('deve atualizar o progresso durante a descoberta', async () => {
  const progressUpdates = [];

  await discoverNetwork('192.168.1.0/30', {
    scanHost: createSuccessfulScanner(),
    onProgress: progress => progressUpdates.push(progress)
  });

  assert.ok(progressUpdates.length >= 3);

  assert.deepEqual(progressUpdates[0], {
    totalHosts: 2,
    completedHosts: 0,
    respondingHosts: 0,
    failedHosts: 0
  });

  const finalProgress = progressUpdates.at(-1);

  assert.equal(finalProgress.completedHosts, 2);
  assert.equal(finalProgress.respondingHosts, 1);
  assert.equal(finalProgress.failedHosts, 0);
});

test('deve ignorar erros lançados pelo callback de progresso', async () => {
  const result = await discoverNetwork('192.168.1.0/30', {
    scanHost: createSuccessfulScanner(),
    onProgress: () => {
      throw new Error('Erro proposital no callback.');
    }
  });

  assert.equal(result.scannedHostCount, 2);
  assert.equal(result.respondingHostCount, 1);
});

test('deve contabilizar falhas individuais de hosts sem interromper a descoberta', async () => {
  const scanner = async host => {
    if (host.endsWith('.1')) {
      throw new Error('Falha simulada.');
    }

    return {
      host,
      checkedAt: new Date().toISOString(),
      openPorts: []
    };
  };

  const result = await discoverNetwork('192.168.1.0/30', {
    scanHost: scanner
  });

  assert.equal(result.scannedHostCount, 2);
  assert.equal(result.respondingHostCount, 0);
  assert.equal(result.failedHostCount, 1);
  assert.equal(result.devices.length, 0);
});

test('deve rejeitar redes públicas', async () => {
  await assert.rejects(
    discoverNetwork('8.8.8.0/30', {
      scanHost: createSuccessfulScanner()
    }),
    /redes IPv4 privadas/
  );
});

test('deve rejeitar redes com quantidade excessiva de hosts', async () => {
  await assert.rejects(
    discoverNetwork('10.0.0.0/22', {
      scanHost: createSuccessfulScanner()
    }),
    /no máximo 254 hosts/
  );
});

test('deve rejeitar CIDR inválido', async () => {
  await assert.rejects(
    discoverNetwork('192.168.1.0/abc', {
      scanHost: createSuccessfulScanner()
    })
  );
});

test('deve rejeitar timeout abaixo do limite permitido', async () => {
  await assert.rejects(
    discoverNetwork('192.168.1.0/30', {
      timeoutMs: 999,
      scanHost: createSuccessfulScanner()
    }),
    /tempo limite deve estar entre/
  );
});

test('deve rejeitar timeout acima do limite permitido', async () => {
  await assert.rejects(
    discoverNetwork('192.168.1.0/30', {
      timeoutMs: 300001,
      scanHost: createSuccessfulScanner()
    }),
    /tempo limite deve estar entre/
  );
});

test('deve rejeitar uma implementação de scanner inválida', async () => {
  await assert.rejects(
    discoverNetwork('192.168.1.0/30', {
      scanHost: 'inválido'
    }),
    /Implementação de scanner inválida/
  );
});

test('deve rejeitar sinal de cancelamento inválido', async () => {
  await assert.rejects(
    discoverNetwork('192.168.1.0/30', {
      signal: {},
      scanHost: createSuccessfulScanner()
    }),
    /Sinal de cancelamento inválido/
  );
});

test('deve rejeitar imediatamente um sinal já cancelado', async () => {
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    discoverNetwork('192.168.1.0/30', {
      signal: controller.signal,
      scanHost: createSuccessfulScanner()
    }),
    error => error.name === 'AbortError'
  );
});

test('deve cancelar uma descoberta em andamento', async () => {
  const controller = new AbortController();
  let scannerStarted = false;

  const scanPromise = discoverNetwork('192.168.1.0/30', {
    signal: controller.signal,
    scanHost: createAbortableScanner(() => {
      scannerStarted = true;
    })
  });

  while (!scannerStarted) {
    await new Promise(resolve => setImmediate(resolve));
  }

  controller.abort();

  await assert.rejects(
    scanPromise,
    error => error.name === 'AbortError'
  );
});

test('deve interromper a descoberta quando o timeout é atingido', async () => {
  await assert.rejects(
    discoverNetwork('192.168.1.0/30', {
      timeoutMs: 1000,
      scanHost: createAbortableScanner()
    }),
    error => error.name === 'TimeoutError'
  );
});

test('deve rejeitar erro de cancelamento lançado pelo scanner', async () => {
  const scanner = async () => {
    const error = new Error('Cancelamento simulado.');
    error.name = 'AbortError';
    throw error;
  };

  await assert.rejects(
    discoverNetwork('192.168.1.0/30', {
      scanHost: scanner
    }),
    error => error.name === 'AbortError'
  );
});
