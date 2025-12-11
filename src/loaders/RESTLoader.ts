import { startCase } from 'lodash';
import { ClientRoutes } from '../components/client/clientRoutes';
import { ControlRoutes } from '../components/control/controlRoutes';

export const loadRoutes = (fastify: FastifyCustomInstance) => {
  const routes = [
    {
      '/client': ClientRoutes,
    },
    {
      '/control': ControlRoutes,
    },
  ];

  for (const route of routes) {
    const [[prefix, fastifyRoutes]] = Object.entries(route);
    //@ts-ignore
    fastify.register(fastifyRoutes(fastify.io), { prefix });
    const routeName = startCase(prefix.substring(1).replaceAll('/', ' '));
    logger.info(`[REST] ${routeName} Routes loaded (${prefix})`);
  }
};
