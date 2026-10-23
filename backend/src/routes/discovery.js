
import {
  getLocalIPv4Addresses,
  discoverNetwork
} from '../discovery/discoveryService.js';

export default async function discoveryRoutes(app) {
  app.get('/api/discovery/interfaces', async () => {
    return {
      interfaces: getLocalIPv4Addresses()
    };
  });

  app.get('/api/discovery/status', async () => {
    return {
      service: 'MultiCam Network Discovery',
      status: 'READY',
      scanExecuted: false,
      interfaces: getLocalIPv4Addresses(),
      message: 'Serviço carregado. Nenhuma varredura real foi executada nesta sessão.'
    };
  });

  app.post('/api/discovery/scan', async (request, reply) => {
    const { cidr } = request.body ?? {};

    if (typeof cidr !== 'string' || !cidr.trim()) {
      return reply.code(400).send({
        error: 'Informe a rede privada no campo cidr.',
        example: {
          cidr: '192.168.1.0/24'
        }
      });
    }

    try {
      const result = await discoverNetwork(cidr.trim());
      return result;
    } catch (error) {
      return reply.code(400).send({
        error: error.message
      });
    }
  });
}
