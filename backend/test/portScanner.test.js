
import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { EventEmitter } from 'node:events';

import {
  testPort,
  scanHost
} from '../src/discovery/portScanner.js';

import {
  connectionLimiter
} from '../src/discovery/connectionLimiter.js';

function createTcpServer(onConnection) {
  const server = net.createServer(onConnection);

  return new Promise((resolve, reject) => {
    server.once('error', reject);

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      resolve({
        server,
        port: address.port,
        close: () => new Promise((closeResolve, closeReject) => {
          server.close(error => {
            if (error) {
              closeReject(error);
              return;
            }

            closeResolve();
          });
        })
      });
    });
  });
}

class ControlledSocket extends EventEmitter {
  constructor(onConnectStarted) {
    super();
    this.onConnectStarted = onConnectStarted;
    this.destroyed = false;
  }

  setTimeout() {
    return this;
  }

  connect() {
    this.onConnectStarted();
    return this;
  }

  destroy() {
    if (this.destroyed) {
      return this;
    }

    this.destroyed = true;

    queueMicrotask(() => {
      this.emit('close');
    });

    return this;
  }
}

test('testPort deve identificar uma porta TCP aberta', async () => {
  const tcp = await createTcpServer();

  try {
    const result = await testPort('127.0.0.1', tcp.port, 1000);
    assert.equal(result, true);
  } finally {
    await tcp.close();
  }
});

test('testPort deve identificar uma porta TCP fechada', async () => {
  const temporary = await createTcpServer();
  const port = temporary.port;

  await temporary.close();

  const result = await testPort('127.0.0.1', port, 1000);

  assert.equal(result, false);
});

test('testPort deve encerrar a conexão após detectar porta aberta', async () => {
  let activeConnections = 0;

  const tcp = await createTcpServer(socket => {
    activeConnections++;

    socket.once('close', () => {
      activeConnections--;
    });
  });

  try {
    const result = await testPort('127.0.0.1', tcp.port, 1000);

    assert.equal(result, true);

    await new Promise(resolve => setTimeout(resolve, 30));

    assert.equal(activeConnections, 0);
  } finally {
    await tcp.close();
  }
});

test('testPort deve cancelar uma operação antes da conexão', async () => {
  const controller = new AbortController();
  const tcp = await createTcpServer();

  try {
    const scanPromise = testPort(
      '127.0.0.1',
      tcp.port,
      5000,
      { signal: controller.signal }
    );

    controller.abort();

    await assert.rejects(
      scanPromise,
      error => error.name === 'AbortError'
    );
  } finally {
    await tcp.close();
  }
});

test('testPort deve cancelar e destruir uma conexão TCP ativa', async () => {
  const controller = new AbortController();

  let socketInstance;
  let connectionStarted = false;
  let resolveConnectionStarted;

  const connectionStartedPromise = new Promise(resolve => {
    resolveConnectionStarted = resolve;
  });

  const socketFactory = () => {
    socketInstance = new ControlledSocket(() => {
      connectionStarted = true;
      resolveConnectionStarted();
    });

    return socketInstance;
  };

  const scanPromise = testPort(
    '127.0.0.1',
    554,
    5000,
    {
      signal: controller.signal,
      socketFactory
    }
  );

  try {
    await connectionStartedPromise;

    assert.equal(connectionStarted, true);
    assert.ok(socketInstance);

    controller.abort();

    await assert.rejects(
      scanPromise,
      error => error.name === 'AbortError'
    );

    assert.equal(socketInstance.destroyed, true);
    assert.equal(connectionLimiter.activeCount, 0);
    assert.equal(connectionLimiter.pendingCount, 0);
  } finally {
    if (!controller.signal.aborted) {
      controller.abort();
    }

    await scanPromise.catch(() => {});
  }
});

test('testPort deve rejeitar imediatamente um sinal já cancelado', async () => {
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    () => testPort('127.0.0.1', 554, 1000, {
      signal: controller.signal
    }),
    error => error.name === 'AbortError'
  );
});

test('scanHost deve identificar portas abertas e fechadas', async () => {
  const tcp = await createTcpServer();

  const temporary = await createTcpServer();
  const closedPort = temporary.port;

  await temporary.close();

  try {
    const result = await scanHost('127.0.0.1', {
      ports: [
        { port: tcp.port, service: 'TEST_OPEN' },
        { port: closedPort, service: 'TEST_CLOSED' }
      ],
      timeoutMs: 1000
    });

    assert.equal(result.host, '127.0.0.1');
    assert.equal(result.ports.length, 2);
    assert.equal(result.openPorts.length, 1);
    assert.equal(result.openPorts[0].port, tcp.port);
    assert.equal(result.ports[1].state, 'CLOSED_OR_FILTERED');
  } finally {
    await tcp.close();
  }
});

test('scanHost deve retornar lista vazia quando não há portas', async () => {
  const result = await scanHost('127.0.0.1', {
    ports: []
  });

  assert.deepEqual(result.ports, []);
  assert.deepEqual(result.openPorts, []);
});

test('scanHost deve rejeitar uma varredura já cancelada', async () => {
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    () => scanHost('127.0.0.1', {
      ports: [
        { port: 554, service: 'RTSP' }
      ],
      signal: controller.signal
    }),
    error => error.name === 'AbortError'
  );
});

test('testPort deve rejeitar host inválido', async () => {
  await assert.rejects(
    () => testPort('', 554, 1000),
    /host/i
  );
});

test('testPort deve rejeitar porta inválida', async () => {
  await assert.rejects(
    () => testPort('127.0.0.1', 0, 1000),
    /porta/i
  );
});

test('testPort deve rejeitar timeout inválido', async () => {
  await assert.rejects(
    () => testPort('127.0.0.1', 554, 0),
    /timeout/i
  );
});
