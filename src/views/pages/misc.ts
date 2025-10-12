import api from '../../api';
import { Cond, perms } from '../../api/utils';
import fs from 'fs/promises';
import { ADDR_PREFIX } from '../../config';
import { RouteHandler } from '..';
import path from 'path';
import { UnauthorizedError } from '../../errors';

const staticDir = path.join(__dirname, '../../static');

export default {
  /* Terms and Agreements */
  async privacyPolicy(_, res) {
    const content = (await fs.readFile(path.join(staticDir, 'privacy_policy.md'))).toString();
    res.prepareRender('docs', { content });
  },
  async termsOfService(_, res) {
    const content = (await fs.readFile(path.join(staticDir, 'ToS.md'))).toString();
    res.prepareRender('docs', { content });
  },
  async codeOfConduct(_, res) {
    const content = (await fs.readFile(path.join(staticDir, 'code_of_conduct.md'))).toString();
    res.prepareRender('docs', { content });
  },

  /* Home Page */
  async home(req, res) {
    const user = req.session.user;
    if (user) {
      const universes = await api.universe.getMany(user, null, perms.WRITE);
      const followedUniverses = await api.universe.getMany(user, {
        strings: ['fu.user_id = ?', 'fu.is_following = ?'],
        values: [user.id, true],
      }, perms.READ);
      const followedUniverseIds = `(${followedUniverses.map(universe => universe.id).join(',')})`;
      const recentlyUpdated = followedUniverses.length > 0 ? await api.item.getMany(user, null, perms.READ, {
        sort: 'updated_at',
        sortDesc: true,
        limit: 8,
        select: [['lub.username', 'last_updated_by']],
        join: [['LEFT', ['user', 'lub'], new Cond('lub.id = item.last_updated_by')]],
        where: new Cond(`item.universe_id IN ${followedUniverseIds}`)
          .and(new Cond('lub.id <> ?', user.id).or(new Cond('item.last_updated_by IS NULL').and('item.author_id <> ?', user.id))),
      }) : [200, []];
      const oldestUpdated = await api.item.getMany(user, null, perms.WRITE, {
        sort: `GREATEST(IFNULL(snooze.snoozed_at, '1000-01-01'), IFNULL(item.updated_at, '1000-01-01'))`,
        sortDesc: false,
        forceSort: true,
        limit: 16,
        join: [['LEFT', 'snooze', new Cond('snooze.item_id = item.id').and('snooze.snoozed_by = ?', user.id)]],
        where: new Cond('item.updated_at < DATE_SUB(NOW(), INTERVAL 2 DAY)'),
        groupBy: ['snooze.snoozed_at'],
      });
      return res.prepareRender('home', { universes, followedUniverses, recentlyUpdated, oldestUpdated });
    }
    res.prepareRender('home', { universes: [] })
  },

  /* Help Pages */
  async markdownDemo(_, res) {
    const content = (await fs.readFile('static/markdown_demo.md')).toString();
    res.prepareRender('markdownDemo', { content });
  },

  /* Note pages */
  async notes(req, res) {
    const user = req.session.user;
    if (!user) throw new UnauthorizedError();
    const notes = await api.note.getByUsername(user, user.username);
    const noteAuthors = { [user.id]: user };
    res.prepareRender('notes', {
      notes,
      noteAuthors,
      noteBaseRoute: `/api/users/${user.username}/notes`,
    });
  },

  /* Misc pages */
  async search(req, res) {
    const search = req.getQueryParam('search');
    if (search) {
      const universes = await api.universe.getMany(req.session.user, { strings: ['title LIKE ?'], values: [`%${search}%`] });
      const items = await api.item.getMany(req.session.user, null, perms.READ, { search });
      const notes = req.session.user ? await api.note.getByUsername(req.session.user, req.session.user.username, null, { search }) : [];
      res.prepareRender('search', { items, universes, notes, search });
    } else {
      res.prepareRender('search', { items: [], universes: [], notes: [], search: '' });
    }
  },

  /* React Editor */
  async editor(req, res) {
    const params = req.params[0]?.split('/') ?? [];
    const data: any = {};
    if (params[0] === 'universes' && params[1]) {
      const [, universeShort] = params;
      data.universe = await api.universe.getOne(req.session.user, { shortname: universeShort });
    }
    res.prepareRender('editor', data);
  }
} satisfies Record<string, RouteHandler>;
