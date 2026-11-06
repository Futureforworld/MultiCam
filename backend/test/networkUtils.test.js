
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ipv4ToNumber,
  isPrivateIPv4,
  parseIPv4Cidr,
  listIPv4Hosts
} from '../src/discovery/networkUtils.js';

test('deve converter IPv4 para número', () => {
  assert.equal(ipv4ToNumber('192.168.1.1'), 3232235777);
  assert.equal(ipv4ToNumber('10.0.0.1'), 167772161);
});

test('deve rejeitar IPv4 inválido', () => {
  assert.throws(() => ipv4ToNumber('192.168.1'));
  assert.throws(() => ipv4ToNumber('192.168.1.256'));
  assert.throws(() => ipv4ToNumber('192.168.1.abc'));
  assert.throws(() => ipv4ToNumber('192.168.1.1.5'));
  assert.throws(() => ipv4ToNumber('192.168.001.010'));
  assert.throws(() => ipv4ToNumber(''));
  assert.throws(() => ipv4ToNumber(null));
});

test('deve identificar corretamente redes IPv4 privadas', () => {
  assert.equal(isPrivateIPv4('10.0.0.1'), true);
  assert.equal(isPrivateIPv4('172.16.0.1'), true);
  assert.equal(isPrivateIPv4('172.31.255.254'), true);
  assert.equal(isPrivateIPv4('192.168.1.1'), true);
  assert.equal(isPrivateIPv4('8.8.8.8'), false);
  assert.equal(isPrivateIPv4('172.32.0.1'), false);
});

test('deve aceitar os limites das três faixas privadas', () => {
  assert.equal(isPrivateIPv4('10.0.0.0'), true);
  assert.equal(isPrivateIPv4('10.255.255.255'), true);

  assert.equal(isPrivateIPv4('172.16.0.0'), true);
  assert.equal(isPrivateIPv4('172.31.255.255'), true);

  assert.equal(isPrivateIPv4('192.168.0.0'), true);
  assert.equal(isPrivateIPv4('192.168.255.255'), true);
});

test('deve rejeitar endereços imediatamente fora das faixas privadas', () => {
  assert.equal(isPrivateIPv4('9.255.255.255'), false);
  assert.equal(isPrivateIPv4('11.0.0.0'), false);

  assert.equal(isPrivateIPv4('172.15.255.255'), false);
  assert.equal(isPrivateIPv4('172.32.0.0'), false);

  assert.equal(isPrivateIPv4('192.167.255.255'), false);
  assert.equal(isPrivateIPv4('192.169.0.0'), false);
});

test('deve interpretar uma rede CIDR privada', () => {
  const network = parseIPv4Cidr('192.168.1.0/24');

  assert.equal(network.prefix, 24);
  assert.equal(network.networkAddress, '192.168.1.0');
  assert.equal(network.hostCount, 254);
  assert.equal(network.isPrivate, true);
});

test('deve rejeitar rede pública', () => {
  assert.throws(() => parseIPv4Cidr('8.8.8.0/24'));
});

test('deve rejeitar máscaras fora do intervalo permitido', () => {
  assert.throws(() => parseIPv4Cidr('192.168.1.0/15'));
  assert.throws(() => parseIPv4Cidr('192.168.1.0/31'));
  assert.throws(() => parseIPv4Cidr('192.168.1.0/32'));
});

test('deve normalizar endereço de interface para o início da rede', () => {
  const network = parseIPv4Cidr('192.168.1.10/24');

  assert.equal(network.networkAddress, '192.168.1.0');
  assert.equal(network.hostCount, 254);
});

test('deve gerar somente endereços de host', () => {
  const network = parseIPv4Cidr('192.168.1.0/30');

  assert.deepEqual(listIPv4Hosts(network), [
    '192.168.1.1',
    '192.168.1.2'
  ]);
});

test('deve rejeitar informações de rede ausentes ou inválidas', () => {
  assert.throws(() => listIPv4Hosts(null));
  assert.throws(() => listIPv4Hosts({}));
  assert.throws(() => listIPv4Hosts({
    network: '192.168.1.0',
    broadcast: 3232236031,
    hostCount: 254
  }));
});

test('deve rejeitar informações inconsistentes de rede', () => {
  const network = parseIPv4Cidr('192.168.1.0/30');

  assert.throws(() => listIPv4Hosts({
    ...network,
    hostCount: 10
  }));

  assert.throws(() => listIPv4Hosts({
    ...network,
    network: -1
  }));

  assert.throws(() => listIPv4Hosts({
    ...network,
    broadcast: 0x100000000
  }));

  assert.throws(() => listIPv4Hosts({
    ...network,
    network: 3232235777
  }));
});

test('deve rejeitar CIDR com formato inválido', () => {
  assert.throws(() => parseIPv4Cidr('192.168.1.0'));
  assert.throws(() => parseIPv4Cidr('192.168.1.0/24/extra'));
  assert.throws(() => parseIPv4Cidr('192.168.1.0/abc'));
  assert.throws(() => parseIPv4Cidr('192.168.1.0/-1'));
  assert.throws(() => parseIPv4Cidr('192.168.1.0/024'));
});
