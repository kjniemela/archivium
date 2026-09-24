import { Server } from '@hocuspocus/server';
import api from './api';
import { perms } from './api/utils';
import { HOCUSPOCUS_PORT } from './config';
import logger from './logger';

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
    } else if (type === 'room') {
      // TTRPG room sync
      const [universeShort] = args;
      const universe = await api.universe.getOne(user, { shortname: universeShort }, perms.READ);
      if (!user || !(universe.author_permissions[user.id] >= perms.ADMIN)) {
        data.connectionConfig.readOnly = true;
      }
    } else if (type === 'scene') {
      // TTRPG scene sync
      const [universeShort, itemShort] = args;
      try {
        await api.item.getByUniverseAndItemShortnames(user, universeShort, itemShort, perms.WRITE, true);
      } catch {
        await api.item.getByUniverseAndItemShortnames(user, universeShort, itemShort, perms.READ, true);
        data.connectionConfig.readOnly = true;
      }
    } else {
      throw new Error('Not Authorized!');
    }
  },
});
logger.info(`Starting hocuspocus server on port ${HOCUSPOCUS_PORT}...`);
server.listen();
