import { Server } from '@hocuspocus/server';
import { HOCUSPOCUS_PORT } from './config';
import logger from './logger';
import api from './api';
import { handleAsNull, perms } from './api/utils';
import { ForbiddenError, UnauthorizedError } from './errors';

const server = new Server({
  name: "hocuspocus-archivium",
  port: HOCUSPOCUS_PORT,
  timeout: 30000,
  debounce: 5000,
  maxDebounce: 30000,
  quiet: true,
  async onAuthenticate(data) {
    const session = await api.session.getOne({ hash: data.token });
    const user = session?.user;
    const [type, ...args] = data.documentName.split('/');
    if (type === 'item') {
      const [universeShort, itemShort] = args;
      const item = await api.item.getByUniverseAndItemShortnames(user, universeShort, itemShort, perms.WRITE, true);
    } else {
      throw new Error('Not Authorized!');
    }
  },
});
logger.info(`Starting hocuspocus server on port ${HOCUSPOCUS_PORT}...`);
server.listen();
