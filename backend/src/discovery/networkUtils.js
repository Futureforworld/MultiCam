
const PRIVATE_IPV4_RANGES = [
  { start: [10, 0, 0, 0], end: [10, 255, 255, 255] },
  { start: [172, 16, 0, 0], end: [172, 31, 255, 255] },
  { start: [192, 168, 0, 0], end: [192, 168, 255, 255] }
];

function ipv4ToNumber(ip) {
  const parts = ip.split('.');

  if (
    parts.length !== 4 ||
    parts.some(part => !/^\d+$/.test(part))
  ) {
    throw new Error('Endereço IPv4 inválido.');
  }

  const octets = parts.map(Number);

  if (octets.some(value => value < 0 || value > 255)) {
    throw new Error('Endereço IPv4 inválido.');
  }

  return (
    ((octets[0] * 256 + octets[1]) * 256 + octets[2]) *
    256 +
    octets[3]
  );
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
  if (typeof cidr !== 'string' || !cidr.includes('/')) {
    throw new Error('Informe a rede no formato IPv4/CIDR, por exemplo 192.168.1.0/24.');
  }

  const [ip, prefixText, ...extra] = cidr.split('/');
  const prefix = Number(prefixText);

  if (
    extra.length > 0 ||
    !Number.isInteger(prefix) ||
    prefix < 16 ||
    prefix > 30 ||
    !isPrivateIPv4(ip)
  ) {
    throw new Error('Rede inválida. Use uma rede IPv4 privada com máscara entre /16 e /30.');
  }

  const ipNumber = ipv4ToNumber(ip);
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  const network = (ipNumber & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const hostCount = broadcast - network - 1;

  if (hostCount < 1 || hostCount > 1022) {
    throw new Error('A rede precisa ter entre 1 e 1022 endereços de host possíveis.');
  }

  const networkAddress = [
    (network >>> 24) & 255,
    (network >>> 16) & 255,
    (network >>> 8) & 255,
    network & 255
  ].join('.');

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

function numberToIPv4(value) {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255
  ].join('.');
}

function listIPv4Hosts(networkInfo) {
  const hosts = [];

  for (
    let address = networkInfo.network + 1;
    address < networkInfo.broadcast;
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
