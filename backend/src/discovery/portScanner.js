
import net from 'node:net';

const DEFAULT_TIMEOUT_MS = 900;
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

function testPort(host, port, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise(resolve => {
    const socket = new net.Socket();
    let finished = false;

    const finish = isOpen => {
      if (finished) return;
      finished = true;
      socket.destroy();
      resolve(isOpen);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));

    socket.connect(port, host);
  });
}

async function mapWithConcurrency(items, concurrency, task) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;

      results[index] = await task(items[index], index);
    }
  }

  const workerCount = Math.min(
    Math.max(1, concurrency),
    items.length
  );

  await Promise.all(
    Array.from({ length: workerCount }, () => worker())
  );

  return results;
}

async function scanHost(
  host,
  {
    ports = CCTV_PORTS,
    timeoutMs = DEFAULT_TIMEOUT_MS
  } = {}
) {
  const results = await mapWithConcurrency(
    ports,
    MAX_CONCURRENT_TESTS,
    async item => {
      const isOpen = await testPort(host, item.port, timeoutMs);

      return {
        port: item.port,
        service: item.service,
        state: isOpen ? 'OPEN' : 'CLOSED_OR_FILTERED'
      };
    }
  );

  return {
    host,
    checkedAt: new Date().toISOString(),
    ports: results,
    openPorts: results.filter(item => item.state === 'OPEN')
  };
}

export {
  CCTV_PORTS,
  testPort,
  scanHost
};
