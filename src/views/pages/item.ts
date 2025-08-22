import { renderToHTMLString } from '@tiptap/static-renderer/pm/html-string';
import sanitizeHtml from 'sanitize-html';
import { RouteHandler } from '..';
import api from '../../api';
import { Comment } from '../../api/models/discussion';
import { Item } from '../../api/models/item';
import { Note } from '../../api/models/note';
import { User } from '../../api/models/user';
import { getPfpUrl, perms } from '../../api/utils';
import { ForbiddenError, NotFoundError } from '../../errors';
import { IndexedDocument, indexedToJson } from '../../lib/tiptapHelpers';
import logger from '../../logger';
import { universeLink } from '../../templates';
import { editorExtensions, extractLinkData, LinkData, TiptapContext } from '../../lib/editor';
import StarterKit from '@tiptap/starter-kit';

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

    let item: Item & { [key: string]: any }; // TODO this is ugly
    try {
      item = await api.item.getByUniverseAndItemShortnames(req.session.user, req.params.universeShortname, req.params.itemShortname) as Item;
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

    item.obj_data = JSON.parse(item.obj_data as string) as Record<string, any>;
    item.itemTypeName = ((universe.obj_data['cats'] ?? {})[item.item_type] ?? ['Missing Category'])[0];
    item.itemTypeColor = ((universe.obj_data['cats'] ?? {})[item.item_type] ?? [,,'#f3f3f3'])[2];
    if (item.gallery && item.gallery.length > 0) {
      item.gallery = item.gallery.sort((a, b) => a.id > b.id ? 1 : -1);
    }

    if ('body' in item.obj_data && typeof item.obj_data.body !== 'string') {
      try {
        const links: LinkData[] = [];
        const headings: { title: string, level: number }[] = [];
        const jsonBody = indexedToJson(
          item.obj_data.body as IndexedDocument,
          (href) => links.push(extractLinkData(href)),
          (title, level) => headings.push({ title, level }),
        );
        const itemsPerUniverse = {};
        /* Because Tiptap rendering cannot be async, we extract the links we'll need to check ahead of time. */
        await Promise.all(links.map(async (link) => {
          if (link.item) {
            const universeShort = link.universe ?? universe.shortname;
            if (!(universeShort in itemsPerUniverse)) {
              itemsPerUniverse[universeShort] = {};
            }
            if (!(link.item in itemsPerUniverse[universeShort])) {
              itemsPerUniverse[universeShort][link.item] = await api.item.exists(req.session.user, universeShort, link.item);
            }
          }
        }));
        const renderContext: TiptapContext = {
          currentUniverse: universe.shortname,
          universeLink: (universeShort) => universeLink(req, universeShort),
          itemExists: (universe, item) => (universe in itemsPerUniverse) && itemsPerUniverse[universe][item],
          headings,
        };
        const htmlBody = renderToHTMLString({ extensions: editorExtensions(false, renderContext), content: jsonBody });
        const sanitizedHtml = sanitizeHtml(htmlBody, {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
          allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            img: ['src', 'alt', 'title', 'width', 'height'],
            h1: ['id'], h2: ['id'], h3: ['id'], h4: ['id'], h5: ['id'], h6: ['id'],
          },
          disallowedTagsMode: 'escape',
          allowedClasses: {
            '*': false,
          },
        });
        item.obj_data.body = {
          type: 'html',
          content: sanitizedHtml,
        };
      } catch (err) {
        logger.error('Failed to parse item body:', err);
        item.obj_data.body = '';
      }
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
    res.prepareRender('editor', { itemShort: req.params.itemShortname, universeShort: req.params.universeShortname });
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
