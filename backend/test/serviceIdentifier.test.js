
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  identifyServices,
  summarizeDevice
} from '../src/discovery/serviceIdentifier.js';

test('deve identificar portas HTTP, HTTPS e RTSP como possíveis serviços', () => {
  const services = identifyServices([
    { port: 80, service: 'HTTP', state: 'OPEN' },
    { port: 443, service: 'HTTPS', state: 'OPEN' },
    { port: 554, service: 'RTSP', state: 'OPEN' }
  ]);

  assert.equal(services.length, 3);

  assert.equal(services[0].signature, 'HTTP');
  assert.equal(services[1].signature, 'HTTPS');
  assert.equal(services[2].signature, 'POSSIBLE_RTSP');

  assert.ok(services.every(
    item => item.confidence === 'LOW'
  ));
});

test('deve reconhecer possíveis portas utilizadas por equipamentos de CFTV', () => {
  const ports = [8000, 8899, 34567, 37777];

  const services = identifyServices(
    ports.map(port => ({
      port,
      service: 'POSSIBLE_CCTV_SERVICE',
      state: 'OPEN'
    }))
  );

  assert.equal(services.length, ports.length);

  assert.ok(services.every(
    item => item.signature === 'POSSIBLE_CCTV_SERVICE'
  ));

  assert.ok(services.every(
    item => item.confidence === 'LOW'
  ));
});

test('deve classificar portas desconhecidas sem identificar fabricante', () => {
  const services = identifyServices([
    {
      port: 12345,
      service: 'UNKNOWN',
      state: 'OPEN'
    }
  ]);

  assert.equal(services[0].signature, 'UNKNOWN');
  assert.equal(services[0].confidence, 'LOW');
  assert.match(services[0].evidence, /ainda não confirmado/i);
});

test('deve atribuir confiança NONE quando a porta não estiver aberta', () => {
  const services = identifyServices([
    {
      port: 554,
      service: 'RTSP',
      state: 'CLOSED_OR_FILTERED'
    }
  ]);

  assert.equal(services[0].confidence, 'NONE');
  assert.match(services[0].evidence, /não foi confirmada como aberta/i);
});

test('deve preservar a identificação do serviço informado pelo scanner', () => {
  const services = identifyServices([
    {
      port: 554,
      service: 'SERVICO_INFORMADO',
      state: 'OPEN'
    }
  ]);

  assert.equal(
    services[0].reportedService,
    'SERVICO_INFORMADO'
  );
});

test('deve utilizar null quando a identificação do serviço estiver ausente', () => {
  const services = identifyServices([
    {
      port: 554,
      state: 'OPEN'
    }
  ]);

  assert.equal(services[0].reportedService, null);
});

test('deve identificar indicadores de possível RTSP e acesso web', () => {
  const result = summarizeDevice([
    { port: 554, service: 'RTSP', state: 'OPEN' },
    { port: 80, service: 'HTTP', state: 'OPEN' }
  ]);

  assert.equal(result.indicators.possibleRtsp, true);
  assert.equal(result.indicators.webAccess, true);
  assert.equal(result.indicators.possibleCctv, true);
});

test('deve manter indicadores falsos quando nenhuma porta relevante estiver aberta', () => {
  const result = summarizeDevice([
    { port: 12345, service: 'UNKNOWN', state: 'OPEN' }
  ]);

  assert.equal(result.indicators.possibleRtsp, false);
  assert.equal(result.indicators.webAccess, false);
  assert.equal(result.indicators.possibleCctv, false);
});

test('deve manter a identificação do equipamento como não confirmada', () => {
  const result = summarizeDevice([
    { port: 554, service: 'RTSP', state: 'OPEN' }
  ]);

  assert.equal(result.identificationStatus, 'UNCONFIRMED');

  assert.match(
    result.note,
    /confirmação exige comunicação específica do protocolo/i
  );
});

test('deve retornar uma lista vazia quando não houver portas', () => {
  const services = identifyServices([]);

  assert.deepEqual(services, []);
});

test('deve retornar indicadores falsos quando não houver portas', () => {
  const result = summarizeDevice([]);

  assert.deepEqual(result.indicators, {
    possibleRtsp: false,
    webAccess: false,
    possibleCctv: false
  });

  assert.equal(result.services.length, 0);
  assert.equal(result.identificationStatus, 'UNCONFIRMED');
});
