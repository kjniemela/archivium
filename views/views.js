const { ADDR_PREFIX, DEV_MODE } = require('../config');
const Auth = require('../middleware/auth');
const api = require('../api');
const md5 = require('md5');
const { perms, Cond } = require('../api/utils');
const fs = require('fs/promises');
const logger = require('../logger');

module.exports = function({ get, post, put }) {
  get(`${ADDR_PREFIX}/`, async (req, res) => {
    const user = req.session.user;
    if (user) {
      const [code1, universes] = await api.universe.getMany(user, null, perms.WRITE);
      res.status(code1);
      if (!universes) return;
      const [code2, followedUniverses] = await api.universe.getMany(user, {
        strings: ['fu.user_id = ?', 'fu.is_following = ?'],
        values: [user.id, true],
      }, perms.READ);
      res.status(code2);
      if (!followedUniverses) return;
      const followedUniverseIds = `(${followedUniverses.map(universe => universe.id).join(',')})`;
      const [code3, recentlyUpdated] = followedUniverses.length > 0 ? await api.item.getMany(user, null, perms.READ, true, {
        sort: 'updated_at',
        sortDesc: true,
        limit: 8,
        select: [['lub.username', 'last_updated_by']],
        join: [['LEFT', ['user', 'lub'], new Cond('lub.id = item.last_updated_by')]],
        where: new Cond(`item.universe_id IN ${followedUniverseIds}`)
          .and(new Cond('lub.id <> ?', user.id).or('item.last_updated_by IS NULL')),
      }) : [200, []];
      res.status(code3);
      const [code4, oldestUpdated] = await api.item.getMany(user, null, perms.WRITE, true, {
        sort: 'updated_at',
        sortDesc: false,
        limit: 16,
        join: [['LEFT', 'snooze', new Cond('snooze.item_id = item.id').and('snooze.snoozed_by = ?', user.id)]],
        where: new Cond('snooze.snoozed_until < NOW()').or('snooze.snoozed_until IS NULL').and('item.updated_at < DATE_SUB(NOW(), INTERVAL 2 DAY)'),
      });
      res.status(code4);
      if (!oldestUpdated) return;
      // if (universes.length === 1) {
      //   res.redirect(`${ADDR_PREFIX}/universes/${universes[0].shortname}`);
      // }
      return res.prepareRender('home', { universes, followedUniverses, recentlyUpdated, oldestUpdated });
    }
    res.prepareRender('home', { universes: [] })
  });

  /* Terms and Agreements */
  get('/privacy-policy', async (_, res) => {
    const content = (await fs.readFile('static/privacy_policy.md')).toString();
    res.prepareRender('docs', { content });
  });
  get('/terms-of-service', async (_, res) => {
    const content = (await fs.readFile('static/ToS.md')).toString();
    res.prepareRender('docs', { content });
  });
  get('/code-of-conduct', async (_, res) => {
    const content = (await fs.readFile('static/code_of_conduct.md')).toString();
    res.prepareRender('docs', { content });
  });

  /* User Pages */
  get('/contacts', Auth.verifySessionOrRedirect, async (req, res) => {
    const [code, contacts] = await api.contact.getAll(req.session.user);
    res.status(code);
    if (!contacts) return;
    const gravatarContacts = contacts.map(user => ({
      ...user,
      gravatarLink: `https://www.gravatar.com/avatar/${md5(user.email)}.jpg`,
    }));
    res.prepareRender('contactList', {
      contacts: gravatarContacts.filter(contact => contact.accepted),
      pending: gravatarContacts.filter(contact => !contact.accepted),
    });
  });

  get('/users/:username', async (req, res) => {
    const [code1, user] = await api.user.getOne({ username: req.params.username });
    res.status(code1);
    if (!user) return;
    const [code2, universes] = await api.universe.getManyByAuthorId(req.session.user, user.id);
    res.status(code2);
    if (!universes) return;
    if (req.session.user?.id !== user.id) {
      const [code3, contact] = await api.contact.getOne(req.session.user, user.id);
      res.status(code3);
      if (code3 !== 200) return;
      user.isContact = contact !== undefined;
    } else {
      user.isMe = true;
    }
    res.prepareRender('user', { 
      user,
      gravatarLink: `https://www.gravatar.com/avatar/${md5(user.email)}.jpg`,
      universes,
    });
  });

  /* Universe Pages */
  get('/universes', async (req, res) => {
    const [code, universes] = await api.universe.getMany(req.session.user);
    res.status(code);
    if (!universes) return;
    res.prepareRender('universeList', { universes });
  });
 
  get('/universes/create', Auth.verifySessionOrRedirect, async (_, res) => {
    res.prepareRender('createUniverse');
  });
  post('/universes/create', Auth.verifySessionOrRedirect, async (req, res) => {
    const [code, data] = await api.universe.post(req.session.user, {
      ...req.body,
      obj_data: decodeURIComponent(req.body.obj_data),
      public: req.body.visibility === 'public',
      discussion_enabled: req.body.discussion_enabled === 'enabled',
      discussion_open: req.body.discussion_open === 'enabled',
    });
    res.status(code);
    if (code === 201) return res.redirect(`${ADDR_PREFIX}/universes/${req.body.shortname}`);
    res.prepareRender('createUniverse', { error: data, ...req.body });
  });
  
  get('/universes/:shortname', async (req, res) => {
    const [code1, universe] = await api.universe.getOne(req.session.user, { shortname: req.params.shortname });
    res.status(code1);
    if (!universe) return;
    const [code2, authors] = await api.user.getByUniverseShortname(req.session.user, universe.shortname);
    res.status(code2);
    if (!authors) return;
    const authorMap = {};
    authors.forEach(author => {
      authorMap[author.id] = {
        ...author,
        gravatarLink: `https://www.gravatar.com/avatar/${md5(author.email)}.jpg`,
      };
    });
    const [code3, threads] = await api.discussion.getThreads(req.session.user, { 'discussion.universe_id': universe.id }, false, true);
    if (!threads) return [code3];
    res.prepareRender('universe', { universe, authors: authorMap, threads });
  });

  get('/universes/:shortname/delete', Auth.verifySessionOrRedirect, async (req, res) => {
    const [code, universe] = await api.universe.getOne(req.session.user, { shortname: req.params.shortname }, perms.ADMIN);
    res.status(code);
    if (!universe) return res.redirect(`${ADDR_PREFIX}/universes`);
    res.prepareRender('deleteUniverse', { universe });
  });

  get('/universes/:shortname/edit', Auth.verifySessionOrRedirect, async (req, res) => {
    const [code, universe] = await api.universe.getOne(req.session.user, { shortname: req.params.shortname }, perms.WRITE);
    res.status(code);
    if (!universe) return;
    res.prepareRender('editUniverse', { universe });
  });
  post('/universes/:shortname/edit', Auth.verifySessionOrRedirect, async (req, res) => {
    req.body = {
      ...req.body,
      obj_data: decodeURIComponent(req.body.obj_data),
      public: req.body.visibility === 'public',
      discussion_enabled: req.body.discussion_enabled === 'enabled',
      discussion_open: req.body.discussion_open === 'enabled',
    }
    const [code, data] = await api.universe.put(req.session.user, req.params.shortname, req.body);
    res.status(code);
    if (code === 200) return res.redirect(`${ADDR_PREFIX}/universes/${req.params.shortname}`);
    res.prepareRender('editUniverse', { error: data, ...req.body });
  });
 
  get('/universes/:shortname/discuss/create', Auth.verifySessionOrRedirect, async (req, res) => {
    const [code, universe] = await api.universe.getOne(req.session.user, { shortname: req.params.shortname }, perms.COMMENT);
    res.status(code);
    if (code !== 200) return;
    res.prepareRender('createUniverseThread', { universe });
  });
  post('/universes/:shortname/discuss/create', Auth.verifySessionOrRedirect, async (req, res) => {
    const [code1, data] = await api.discussion.postUniverseThread(req.session.user, req.params.shortname, { title: req.body.title });
    res.status(code1);
    if (code1 === 201) {
      if (req.body.comment) {
        const [code2, _] = await api.discussion.postCommentToThread(req.session.user, data.insertId, { body: req.body.comment });
        res.status(code2);
      }
      return res.redirect(`${ADDR_PREFIX}/universes/${req.params.shortname}/discuss/${data.insertId}`);
    }
    const [code3, universe] = await api.universe.getOne(req.session.user, { shortname: req.params.shortname });
    res.status(code3);
    if (code3 !== 200) return;
    res.prepareRender('createUniverseThread', { error: data, ...req.body, universe });
  });
  get('/universes/:shortname/discuss/:threadId', Auth.verifySessionOrRedirect, async (req, res) => {
    const [code1, universe] = await api.universe.getOne(req.session.user, { shortname: req.params.shortname });
    res.status(code1);
    if (code1 !== 200) return;
    const [code2, threads] = await api.discussion.getThreads(req.session.user, { 'discussion.id': req.params.threadId });
    if (!threads) return [code2];
    const thread = threads[0];
    if (!thread) return [code2];
    const [code3, comments, users] = await api.discussion.getCommentsByThread(req.session.user, thread.id, false, true);
    if (!comments || !users) return [code3];
    const commenters = {};
    for (const user of users) {
      user.gravatarLink = `https://www.gravatar.com/avatar/${md5(user.email)}.jpg`;
      delete user.email;
      commenters[user.id] = user;
    }
    
    res.prepareRender('universeThread', { 
      universe, thread, comments, commenters,
      commentAction: `/universes/${universe.shortname}/discuss/${thread.id}/comment`,
    });
  });
  post('/universes/:shortname/discuss/:threadId/comment', Auth.verifySessionOrRedirect, async (req, res) => {
    const [code, _] = await api.discussion.postCommentToThread(req.session.user, req.params.threadId, req.body);
    res.status(code);
    return res.redirect(`${ADDR_PREFIX}/universes/${req.params.shortname}/discuss/${req.params.threadId}`);
  });

  get('/universes/:shortname/items', async (req, res) => {
    const [code1, universe] = await api.universe.getOne(req.session.user, { shortname: req.params.shortname });
    const [code2, items] = await api.item.getByUniverseShortname(req.session.user, req.params.shortname, perms.READ, true, {
      sort: req.query.sort,
      sortDesc: req.query.sort_order === 'desc',
      limit: req.query.limit,
      type: req.query.type,
      tag: req.query.tag,
    });
    const code = code1 !== 200 ? code1 : code2;
    res.status(code);
    if (code !== 200) return;
    res.prepareRender('universeItemList', {
      items: items.map(item => ({ ...item, itemTypeName: ((universe.obj_data.cats ?? {})[item.item_type] ?? ['missing_cat'])[0] })),
      universe,
      type: req.query.type,
      tag: req.query.tag,
    });
  });
 
  get('/universes/:shortname/items/create', Auth.verifySessionOrRedirect, async (req, res) => {
    const [code, universe] = await api.universe.getOne(req.session.user, { shortname: req.params.shortname });
    res.status(code);
    if (code !== 200) return;
    res.prepareRender('createItem', { universe, item_type: req.query.type, shortname: req.query.shortname });
  });
  post('/universes/:shortname/items/create', Auth.verifySessionOrRedirect, async (req, res) => {
    const [userCode, data] = await api.item.post(req.session.user, {
      ...req.body,
    }, req.params.shortname);
    res.status(userCode);
    if (userCode === 201) return res.redirect(`${ADDR_PREFIX}/universes/${req.params.shortname}/items/${req.body.shortname}`);
    const [code, universe] = await api.universe.getOne(req.session.user, { shortname: req.params.shortname });
    res.status(code);
    if (code !== 200) return;
    res.prepareRender('createItem', { error: data, ...req.body, universe });
  });

  get('/universes/:universeShortname/items/:itemShortname', async (req, res) => {
    const [code1, universe] = await api.universe.getOne(req.session.user, { shortname: req.params.universeShortname });
    const [code2, item] = await api.item.getByUniverseAndItemShortnames(req.session.user, req.params.universeShortname, req.params.itemShortname);
    res.status(code1);
    if (code1 !== 200) return;
    if (!item) {
      if (universe.author_permissions[req.session.user?.id] >= perms.READ) {
        res.status(404);
        res.prepareRender('error', {
          code: 404,
          hint: 'Looks like this item doesn\'t exist yet. Follow the link below to create it:',
          hintLink: `${ADDR_PREFIX}/universes/${req.params.universeShortname}/items/create?shortname=${req.params.itemShortname}`,
        });
      } else {
        res.status(code2);
      }
      return;
    }
    item.obj_data = JSON.parse(item.obj_data);
    item.itemTypeName = ((universe.obj_data.cats ?? {})[item.item_type] ?? ['missing_cat'])[0];
    if (item.gallery.length > 0) {
      item.gallery = item.gallery.sort((a, b) => a[0] > b[0] ? 1 : -1);
    }
    const [code3, comments, users] = await api.discussion.getCommentsByItem(req.session.user, item.id, false, true);
    if (!comments || !users) return [code3];
    const commenters = {};
    for (const user of users) {
      user.gravatarLink = `https://www.gravatar.com/avatar/${md5(user.email)}.jpg`;
      delete user.email;
      commenters[user.id] = user;
    }
    res.prepareRender('item', {
      item, universe, tab: req.query.tab, comments, commenters,
      commentAction: `/universes/${universe.shortname}/items/${item.shortname}/comment`,
    });
  });
  get('/universes/:universeShortname/items/:itemShortname/edit', Auth.verifySessionOrRedirect, async (req, res) => {
    const [code1, item] = await api.item.getByUniverseAndItemShortnames(req.session.user, req.params.universeShortname, req.params.itemShortname, perms.WRITE);
    res.status(code1);
    if (!item) return;
    const [code2, itemList] = await api.item.getByUniverseId(req.session.user, item.universe_id, perms.READ, true, { type: 'character' });
    res.status(code2);
    if (code2 !== 200) return;
    item.obj_data = JSON.parse(item.obj_data);
    if (Object.keys(item.parents).length > 0 || Object.keys(item.children).length > 0) {
      item.obj_data.lineage = { ...item.obj_data.lineage };
      item.obj_data.lineage.parents = item.parents;
      item.obj_data.lineage.children = item.children;
    }
    if (item.events.length > 0) {
      item.obj_data.timeline = { ...item.obj_data.timeline };
      item.obj_data.timeline.events = item.events
        .map(([srcShort, src, srcId, title, time]) => ({
          title,
          time,
          imported: srcShort !== item.shortname,
          src,
          srcId,
        }));
    }
    if (item.gallery.length > 0) {
      item.obj_data.gallery = { ...item.obj_data.gallery };
      item.obj_data.gallery.imgs = item.gallery
        .map(([id, name, label]) => ({
          id,
          url: `/api/universes/${item.universe_short}/items/${item.shortname}/gallery/images/${id}`,
          name,
          label,
        }))
        .sort((a, b) => a.id > b.id ? 1 : -1);
    }
    const itemMap = {};
    itemList.forEach(item => itemMap[item.shortname] = item.title);
    res.prepareRender(req.query.mode === 'raw' ? 'editItemRaw' : 'editItem', { item, itemMap });
  });
  post('/universes/:universeShortname/items/:itemShortname/edit', Auth.verifySessionOrRedirect, async (req, res) => {
    const [code, err] = await api.item.save(req.session.user, req.params.universeShortname, req.params.itemShortname, req.body);
    res.status(code);
    if (err) {
      return res.prepareRender('editItem', { error: err, ...body });
    }
    res.redirect(`${ADDR_PREFIX}/universes/${req.params.universeShortname}/items/${req.params.itemShortname}`);
  });
  post('/universes/:universeShortname/items/:itemShortname/comment', Auth.verifySessionOrRedirect, async (req, res) => {
    const [code, _] = await api.discussion.postCommentToItem(req.session.user, req.params.universeShortname, req.params.itemShortname, req.body);
    res.status(code);
    res.redirect(`${ADDR_PREFIX}/universes/${req.params.universeShortname}/items/${req.params.itemShortname}?tab=comments`);
  });

  get('/universes/:shortname/permissions', Auth.verifySessionOrRedirect, async (req, res) => {
    const [code1, universe] = await api.universe.getOne(req.session.user, { shortname: req.params.shortname }, perms.ADMIN);
    const [code2, users] = await api.user.getMany();
    const [code3, contacts] = await api.contact.getAll(req.session.user);
    const code = code1 !== 200 ? code1 : (code2 !== 200 ? code2 : code3);
    res.status(code);
    if (code !== 200) return;
    contacts.forEach(contact => {
      if (!(contact.id in universe.authors)) {
        universe.authors[contact.id] = contact.username;
        universe.author_permissions[contact.id] = perms.NONE;
      }
    });
    res.prepareRender('editUniversePerms', { universe, users });
  });
  post('/universes/:shortname/permissions', Auth.verifySessionOrRedirect, async (req, res) => {
    const { session, params, body } = req;
    const [_, user] = await api.user.getOne({ username: req.body.username });
    const [code, data] = await api.universe.putPermissions(session.user, params.shortname, user, body.permission_level, perms.ADMIN);
    res.status(code);
    if (code !== 200) return;
    res.redirect(`${ADDR_PREFIX}/universes/${params.shortname}/permissions`);
  });

  get('/search', async (req, res) => {
    const search = req.query.search;
    if (search) {
      const [code1, universes] = await api.universe.getMany(req.session.user, { strings: ['title LIKE ?'], values: [`%${search}%`] });
      const [code2, items] = await api.item.getMany(req.session.user, null, perms.READ, true, { search });
      const code = code1 !== 200 ? code1 : code2;
      res.status(code);
      if (code !== 200) return;
      res.prepareRender('search', { items, universes, search });
    } else {
      res.prepareRender('search', { items: [], universes: [], search: '' });
    }
    
  });
}