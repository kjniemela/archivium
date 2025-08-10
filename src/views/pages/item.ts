import { RouteHandler } from '..';
import api from '../../api';
import { Comment } from '../../api/models/discussion';
import { Item } from '../../api/models/item';
import { Note } from '../../api/models/note';
import { User } from '../../api/models/user';
import { getPfpUrl, perms } from '../../api/utils';
import { ForbiddenError, NotFoundError } from '../../errors';
import { universeLink } from '../../templates';

export default {
  async list(req, res) {
    const search = req.getQueryParam('search');
    const universes = await api.universe.getMany(req.session.user);
    const items = await api.item.getMany(req.session.user, null, Math.max(perms.READ, Number(req.query.perms)) || perms.READ, {
      sort: req.getQueryParam('sort'),
      sortDesc: req.getQueryParam('sort_order') === 'desc',
      limit: req.getQueryParamAsNumber('limit'),
      type: req.getQueryParam('type'),
      tag: req.getQueryParam('tag'),
      universe: req.getQueryParam('universe'),
      author: req.getQueryParam('author'),
      search,
    });
    const universeCats = universes.reduce((cats, universe) => {
      universe.obj_data = JSON.parse(universe.obj_data);
      return { ...cats, [universe.id]: universe.obj_data['cats'] };
    }, {});
    res.prepareRender('itemList', {
      items: items.map(item => ({ ...item, itemTypeName: ((universeCats[item.universe_id] ?? {})[item.item_type] ?? ['Missing Category'])[0] })),
      type: req.query.type,
      tag: req.query.tag,
      universe: req.query.universe,
      author: req.query.author,
      showUniverse: true,
      search,
    });
  },

  async create(req, res) {
    const universe = await api.universe.getOne(req.session.user, { shortname: req.params.universeShortname }, perms.WRITE);
    res.prepareRender('createItem', { universe, item_type: req.query.type, shortname: req.query.shortname });
  },

  async view(req, res) {
    const universe = await api.universe.getOne(req.session.user, { shortname: req.params.universeShortname });

    let item: Item & { [key: string]: any };
    try {
      item = await api.item.getByUniverseAndItemShortnames(req.session.user, req.params.universeShortname, req.params.itemShortname);
    } catch (err) {
      if (err instanceof ForbiddenError) {
        if (req.session.user && universe.author_permissions[req.session.user.id] >= perms.READ) {
          res.status(404);
          res.prepareRender('error', {
            code: 404,
            hint: 'Looks like this item doesn\'t exist yet. Follow the link below to create it:',
            hintLink: `${universeLink(req, req.params.universeShortname)}/items/create?shortname=${req.params.itemShortname}`,
          });
          return;
        }
      }
      throw err;
    }

    item.obj_data = JSON.parse(item.obj_data as string);
    item.itemTypeName = ((universe.obj_data['cats'] ?? {})[item.item_type] ?? ['Missing Category'])[0];
    item.itemTypeColor = ((universe.obj_data['cats'] ?? {})[item.item_type] ?? [,,'#f3f3f3'])[2];
    if (item.gallery.length > 0) {
      item.gallery = item.gallery.sort((a, b) => a.id > b.id ? 1 : -1);
    }

    const [comments, commentUsers] = await api.discussion.getCommentsByItem(item.id, true) as [Comment[], User[]];
    const commenters = {};
    for (const user of commentUsers) {
      user.pfpUrl = getPfpUrl(user);
      delete user.email;
      commenters[user.id] = user;
    }

    const [notes, noteUsers] = await api.note.getByItemShortname(req.session.user, universe.shortname, item.shortname, {}, {}, true) as [Note[], User[]];
    const noteAuthors = {};
    for (const user of noteUsers) {
      user.pfpUrl = getPfpUrl(user);
      delete user.email;
      noteAuthors[user.id] = user;
    }

    res.prepareRender('item', {
      item, universe, tab: req.query.tab, comments, commenters, notes, noteAuthors,
      commentAction: `${universeLink(req, universe.shortname)}/items/${item.shortname}/comment`,
      noteBaseRoute: `/api/universes/${universe.shortname}/items/${item.shortname}/notes`,
    });
  },

  async edit(req, res) {
    const fetchedItem = await api.item.getByUniverseAndItemShortnames(req.session.user, req.params.universeShortname, req.params.itemShortname, perms.WRITE);
    const item = {...fetchedItem, ...(req.body ?? {}), shortname: fetchedItem.shortname, newShort: req.body?.shortname ?? fetchedItem.shortname};
    const itemList = await api.item.getByUniverseId(req.session.user, item.universe_id, perms.READ, { type: 'character' });
    const universe = await api.universe.getOne(req.session.user, { shortname: req.params.universeShortname });
    item.obj_data = JSON.parse(item.obj_data);
    if (item.parents.length > 0 || item.children.length > 0) {
      item.obj_data.lineage = { ...item.obj_data.lineage };
      item.obj_data.lineage.parents = item.parents.reduce((obj, val) => ({ ...obj, [val.parent_shortname]: [val.parent_label, val.child_label] }), {});
      item.obj_data.lineage.children = item.children.reduce((obj, val) => ({ ...obj, [val.child_shortname]: [val.child_label, val.parent_label] }), {});
    }
    if (item.events.length > 0) {
      item.obj_data.timeline = { ...item.obj_data.timeline };
      item.obj_data.timeline.events = item.events
        .map(({ event_title, abstime, src_shortname, src_title, src_id }) => ({
          title: event_title,
          time: abstime,
          imported: src_shortname !== item.shortname,
          src: src_title,
          srcId: src_id,
        }));
    }
    if (item.gallery.length > 0) {
      item.obj_data.gallery = { ...item.obj_data.gallery };
      item.obj_data.gallery.imgs = item.gallery
        .map(({ id, name, label }) => ({
          id,
          url: `/api/universes/${item.universe_short}/items/${item.shortname}/gallery/images/${id}`,
          name,
          label,
        }))
        .sort((a, b) => a.id > b.id ? 1 : -1);
    }
    const itemMap = {};
    itemList.forEach(item => itemMap[item.shortname] = item.title);
    res.prepareRender('editItem', { item, itemMap, universe, error: res.error });
  },

  async delete(req, res) {
    try {
      const item = await api.item.getByUniverseAndItemShortnames(req.session.user, req.params.universeShortname, req.params.itemShortname, perms.OWNER);
      res.prepareRender('deleteItem', { item });
    } catch (err) {
      if (err instanceof NotFoundError) {
        return res.redirect(`${universeLink(req, req.params.universeShortname)}/items`);
      }
      throw err;
    }
  },
} satisfies Record<string, RouteHandler>;
