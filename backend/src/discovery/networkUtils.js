
const PRIVATE_IPV4_RANGES = [
  { start: [10, 0, 0, 0], end: [10, 255, 255, 255] },
  { start: [172, 16, 0, 0], end: [172, 31, 255, 255] },
  { start: [192, 168, 0, 0], end: [192, 168, 255, 255] }
];

const MIN_PREFIX = 16;
const MAX_PREFIX = 30;
const MAX_HOST_COUNT = 1022;

function ipv4ToNumber(ip) {
  if (typeof ip !== 'string') {
    throw new Error('Endereço IPv4 inválido.');
  }

  const parts = ip.split('.');

  if (
    parts.length !== 4 ||
    parts.some(part => !/^(0|[1-9]\d{0,2})$/.test(part))
  ) {
    throw new Error('Endereço IPv4 inválido.');
  }

  const octets = parts.map(Number);

  if (octets.some(value => value > 255)) {
    throw new Error('Endereço IPv4 inválido.');
  }

  return (
    ((octets[0] * 256 + octets[1]) * 256 + octets[2]) *
    256 +
    octets[3]
  );
}

function numberToIPv4(value) {
  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > 0xFFFFFFFF
  ) {
    throw new Error('Número IPv4 inválido.');
  }

  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255
  ].join('.');
}

function isPrivateIPv4(ip) {
  const value = ipv4ToNumber(ip);

  return PRIVATE_IPV4_RANGES.some(({ start, end }) => {
    return (
      value >= ipv4ToNumber(start.join('.')) &&
      value <= ipv4ToNumber(end.join('.'))
    );
  });
}

function parseIPv4Cidr(cidr) {
  if (typeof cidr !== 'string') {
    throw new Error(
      'Informe a rede no formato IPv4/CIDR, por exemplo 192.168.1.0/24.'
    );
  }

  const parts = cidr.split('/');

  if (parts.length !== 2) {
    throw new Error(
      'Informe a rede no formato IPv4/CIDR, por exemplo 192.168.1.0/24.'
    );
  }

  const [ip, prefixText] = parts;

  if (!/^(0|[1-9]\d*)$/.test(prefixText)) {
    throw new Error('Prefixo CIDR inválido.');
  }

  const prefix = Number(prefixText);

  if (
    !Number.isInteger(prefix) ||
    prefix < MIN_PREFIX ||
    prefix > MAX_PREFIX
  ) {
    throw new Error(
      `Use uma máscara IPv4 entre /${MIN_PREFIX} e /${MAX_PREFIX}.`
    );
  }

  if (!isPrivateIPv4(ip)) {
    throw new Error(
      'A descoberta aceita somente redes IPv4 privadas autorizadas.'
    );
  }

  const ipNumber = ipv4ToNumber(ip);

  const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
  const network = (ipNumber & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;

  const hostCount = broadcast - network - 1;

  if (
    !Number.isSafeInteger(hostCount) ||
    hostCount < 1 ||
    hostCount > MAX_HOST_COUNT
  ) {
    throw new Error(
      `A rede precisa ter entre 1 e ${MAX_HOST_COUNT} endereços de host possíveis.`
    );
  }

  const networkAddress = numberToIPv4(network);

  return {
    cidr,
    prefix,
    network,
    broadcast,
    hostCount,
    networkAddress,
    isPrivate: true
  };
}

function listIPv4Hosts(networkInfo) {
  if (
    !networkInfo ||
    !Number.isInteger(networkInfo.network) ||
    !Number.isInteger(networkInfo.broadcast) ||
    !Number.isInteger(networkInfo.hostCount)
  ) {
    throw new Error('Informações de rede IPv4 inválidas.');
  }

  const {
    network,
    broadcast,
    hostCount
  } = networkInfo;

  if (
    network < 0 ||
    broadcast > 0xFFFFFFFF ||
    network >= broadcast ||
    hostCount !== broadcast - network - 1 ||
    hostCount < 1 ||
    hostCount > MAX_HOST_COUNT ||
    !isPrivateIPv4(numberToIPv4(network))
  ) {
    throw new Error('Informações de rede IPv4 inválidas.');
  }

  const hosts = [];

  for (
    let address = network + 1;
    address < broadcast;
    address++
  ) {
    hosts.push(numberToIPv4(address));
  }

  return hosts;
}

export {
  ipv4ToNumber,
  isPrivateIPv4,
  parseIPv4Cidr,
  listIPv4Hosts
};
