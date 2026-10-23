
const SERVICE_SIGNATURES = {
  80: 'HTTP',
  443: 'HTTPS',
  554: 'POSSIBLE_RTSP',
  8000: 'POSSIBLE_CCTV_SERVICE',
  8080: 'POSSIBLE_HTTP_ALT',
  8899: 'POSSIBLE_CCTV_SERVICE',
  34567: 'POSSIBLE_CCTV_SERVICE',
  37777: 'POSSIBLE_CCTV_SERVICE'
};

function identifyServices(openPorts = []) {
  return openPorts.map(({ port, service, state }) => {
    const signature = SERVICE_SIGNATURES[port] ?? 'UNKNOWN';

    let confidence = 'LOW';
    let evidence = 'Porta TCP aberta; serviço ainda não confirmado.';

    if (port === 80 || port === 443 || port === 8080) {
      evidence = 'Porta convencional de acesso web aberta; aplicação não confirmada.';
    }

    if (port === 554) {
      evidence = 'Porta frequentemente usada por RTSP; protocolo ainda não confirmado.';
    }

    if ([8000, 8899, 34567, 37777].includes(port)) {
      evidence = 'Porta encontrada em alguns equipamentos de CFTV; fabricante não identificado.';
    }

    if (state && state !== 'OPEN') {
      confidence = 'NONE';
      evidence = 'A porta não foi confirmada como aberta.';
    }

    return {
      port,
      reportedService: service ?? null,
      signature,
      confidence,
      evidence
    };
  });
}

function summarizeDevice(openPorts = []) {
  const services = identifyServices(openPorts);

  const possibleRtsp = services.some(
    item => item.port === 554 && item.confidence !== 'NONE'
  );

  const webAccess = services.some(
    item => [80, 443, 8080].includes(item.port) &&
      item.confidence !== 'NONE'
  );

  const possibleCctv = services.some(
    item => [
      554, 8000, 8899, 34567, 37777
    ].includes(item.port) &&
      item.confidence !== 'NONE'
  );

  return {
    services,
    indicators: {
      possibleRtsp,
      webAccess,
      possibleCctv
    },
    identificationStatus: 'UNCONFIRMED',
    note: 'Os indicadores são pistas baseadas nas portas abertas. A confirmação exige comunicação específica do protocolo ou integração validada.'
  };
}

export {
  identifyServices,
  summarizeDevice
};
