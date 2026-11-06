
import {
  randomUUID
} from 'node:crypto';

import {
  getLocalIPv4Addresses,
  discoverNetwork
} from '../discovery/discoveryService.js';

import {
  parseIPv4Cidr
} from '../discovery/networkUtils.js';

const DEFAULT_SCAN_COOLDOWN_MS = 30_000;
const MAX_SCAN_COOLDOWN_MS = 300_000;

export default async function discoveryRoutes(
  app,
  options = {}
) {
  const authenticate = app.authenticate;

  if (typeof authenticate !== 'function') {
    throw new Error(
      'Autenticação JWT não configurada para o serviço de descoberta.'
    );
  }

  const discoveryService = options.discoveryService ?? {
    getLocalIPv4Addresses,
    discoverNetwork
  };

  if (
    typeof discoveryService.getLocalIPv4Addresses !== 'function' ||
    typeof discoveryService.discoverNetwork !== 'function'
  ) {
    throw new Error(
      'Serviço de descoberta inválido.'
    );
  }

  const scanCooldownMs =
    options.scanCooldownMs ?? DEFAULT_SCAN_COOLDOWN_MS;

  if (
    !Number.isInteger(scanCooldownMs) ||
    scanCooldownMs < 0 ||
    scanCooldownMs > MAX_SCAN_COOLDOWN_MS
  ) {
    throw new Error(
      'Intervalo entre varreduras inválido. Informe um número inteiro entre 0 e 300000 milissegundos.'
    );
  }

  let currentScan = null;
  let lastScan = null;
  let lastScanAttemptAt = null;

  function getScanStatus() {
    if (currentScan) {
      return {
        service: 'MultiCam Network Discovery',
        status: 'RUNNING',
        scanInProgress: true,
        scanExecuted: true,
        scan: {
          id: currentScan.id,
          network: currentScan.network,
          startedAt: currentScan.startedAt,
          progress: { ...currentScan.progress }
        },
        interfaces: discoveryService.getLocalIPv4Addresses(),
        message: 'Uma varredura está em andamento.'
      };
    }

    return {
      service: 'MultiCam Network Discovery',
      status: lastScan?.status ?? 'READY',
      scanInProgress: false,
      scanExecuted: Boolean(lastScan),
      scan: lastScan,
      interfaces: discoveryService.getLocalIPv4Addresses(),
      message: lastScan?.message ??
        'Serviço carregado. Nenhuma varredura está em andamento.'
    };
  }

  app.get('/api/discovery/interfaces', {
    preHandler: [authenticate]
  }, async () => {
    return {
      interfaces: discoveryService.getLocalIPv4Addresses()
    };
  });

  app.get('/api/discovery/status', {
    preHandler: [authenticate]
  }, async () => {
    return getScanStatus();
  });

  app.post('/api/discovery/scan', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    if (request.authUser?.role !== 'superadmin') {
      return reply.code(403).send({
        error: 'Apenas o superadministrador pode executar varreduras de rede.'
      });
    }

    const body = request.body;

    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body)
    ) {
      return reply.code(400).send({
        error: 'O corpo da requisição deve ser um objeto JSON.'
      });
    }

    const { cidr } = body;

    if (typeof cidr !== 'string' || !cidr.trim()) {
      return reply.code(400).send({
        error: 'Informe a rede privada no campo cidr.',
        example: {
          cidr: '192.168.1.0/24'
        }
      });
    }

    const normalizedCidr = cidr.trim();

    try {
      parseIPv4Cidr(normalizedCidr);
    } catch {
      return reply.code(400).send({
        error: 'Rede IPv4/CIDR inválida ou não permitida.'
      });
    }

    if (currentScan) {
      return reply.code(409).send({
        error: 'Já existe uma varredura de rede em andamento.'
      });
    }

    if (lastScanAttemptAt !== null) {
      const elapsedMs = Date.now() - lastScanAttemptAt;
      const remainingMs = scanCooldownMs - elapsedMs;

      if (remainingMs > 0) {
        const retryAfterSeconds = Math.ceil(
          remainingMs / 1000
        );

        reply.header(
          'Retry-After',
          String(retryAfterSeconds)
        );

        return reply.code(429).send({
          error: 'Aguarde antes de iniciar outra varredura.',
          retryAfterSeconds
        });
      }
    }

    const controller = new AbortController();

    const scan = {
      id: randomUUID(),
      network: normalizedCidr,
      startedAt: new Date().toISOString(),
      progress: {
        totalHosts: 0,
        completedHosts: 0,
        respondingHosts: 0,
        failedHosts: 0
      },
      controller
    };

    currentScan = scan;

    try {
      const result = await discoveryService.discoverNetwork(
        normalizedCidr,
        {
          signal: controller.signal,
          onProgress: progress => {
            if (currentScan?.id === scan.id) {
              scan.progress = { ...progress };
            }
          }
        }
      );

      const finishedAt = new Date().toISOString();

      const progress = {
        ...scan.progress
      };

      lastScan = {
        id: scan.id,
        network: normalizedCidr,
        status: 'COMPLETED',
        startedAt: scan.startedAt,
        finishedAt,
        progress,
        scannedHostCount:
          result.scannedHostCount ??
          progress.completedHosts,
        respondingHostCount:
          result.respondingHostCount ??
          progress.respondingHosts,
        failedHostCount:
          result.failedHostCount ??
          progress.failedHosts,
        message: 'Varredura concluída.'
      };

      return reply.code(200).send(result);
    } catch (error) {
      const cancelled =
        controller.signal.aborted ||
        error.name === 'AbortError';

      lastScan = {
        id: scan.id,
        network: normalizedCidr,
        status: cancelled ? 'CANCELLED' : 'FAILED',
        startedAt: scan.startedAt,
        finishedAt: new Date().toISOString(),
        progress: { ...scan.progress },
        message: cancelled
          ? 'Varredura cancelada.'
          : 'Não foi possível concluir a varredura.'
      };

      if (!cancelled) {
        request.log.error(
          { err: error },
          'Falha inesperada durante a descoberta de rede.'
        );
      }

      return reply.code(cancelled ? 409 : 500).send({
        error: cancelled
          ? 'A varredura foi cancelada.'
          : 'Não foi possível concluir a descoberta de rede.'
      });
    } finally {
      lastScanAttemptAt = Date.now();

      if (currentScan?.id === scan.id) {
        currentScan = null;
      }
    }
  });

  app.post('/api/discovery/cancel', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    if (request.authUser?.role !== 'superadmin') {
      return reply.code(403).send({
        error: 'Apenas o superadministrador pode cancelar varreduras.'
      });
    }

    if (!currentScan) {
      return reply.code(409).send({
        error: 'Não existe uma varredura em andamento.'
      });
    }

    const scanId = currentScan.id;

    currentScan.controller.abort();

    return reply.code(200).send({
      message: 'Solicitação de cancelamento enviada.',
      scanId
    });
  });
}
