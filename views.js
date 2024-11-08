const { ADDR_PREFIX, DEV_MODE } = require('./config');
const Auth = require('./middleware/auth');
const api = require('./api');
const md5 = require('md5');
const { render } = require('./templates');
const { perms, Cond } = require('./api/utils');

module.exports = function(app) {
  app.use((req, res, next) => {
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.prepareRender = (template, data={}) => {
      res.templateData = [template, data];
    };
    next();
  })

  const doRender = (req, res, next) => {
    if (res.statusCode === 302) return next(); // We did a redirect, no need to render.
    try {
      const [template, data] = res.templateData;
      res.end(render(req, template, data));
    } catch (err) {
      console.error(`Error ${res.statusCode} rendered.`);
      if (DEV_MODE) {
        console.error('Reason:');
        console.error(err);
      }
      res.end(render(req, 'error', { code: res.statusCode }));
    }
    next();
  };

  function use(method, path, ...middleware) {
    const handler = middleware.pop();
    if (!(['get', 'post', 'put'].includes(method))) throw `Illegal method: ${method}`;
    app[method](`${ADDR_PREFIX}${path}`, ...middleware, async (req, res, next) => {
      await handler(req, res);
      next();
    }, doRender);
  }
  const get = (...args) => use('get', ...args);
  const post = (...args) => use('post', ...args);
  const put = (...args) => use('put', ...args);

  get(`${ADDR_PREFIX}/`, async (req, res) => {
    const user = req.session.user;
    if (user) {
      const [code1, universes] = await api.universe.getMany(user, null, perms.WRITE);
      res.status(code1);
      if (!universes) return;
      const [code2, recentlyUpdated] = await api.item.getMany(user, {
        strings: ['lub.id <> ? OR item.last_updated_by IS NULL', 'item.author_id <> ?'],
        values: [user.id, user.id],
      }, perms.READ, true, {
        sort: 'updated_at',
        sortDesc: true,
        limit: 8,
        select: [['lub.username', 'last_updated_by']],
        join: [['LEFT', ['user', 'lub'], new Cond('lub.id = item.last_updated_by')]],
        where: new Cond('au_filter.user_id = ?', user.id),
      });
      res.status(code2);
      const [code3, oldestUpdated] = await api.item.getMany(user, null, perms.WRITE, true, {
        sort: 'updated_at',
        sortDesc: false,
        limit: 16,
        join: [['LEFT', 'snooze', new Cond('snooze.item_id = item.id').and('snooze.snoozed_by = ?', user.id)]],
        where: new Cond('snooze.snoozed_until < NOW()').or('snooze.snoozed_until IS NULL').and('item.updated_at < DATE_SUB(NOW(), INTERVAL 2 DAY)'),
      });
      res.status(code3);
      if (!oldestUpdated) return;
      // if (universes.length === 1) {
      //   res.redirect(`${ADDR_PREFIX}/universes/${universes[0].shortname}`);
      // }
      return res.prepareRender('home', { universes, recentlyUpdated, oldestUpdated });
    }
    res.prepareRender('home', { universes: [] })
  });

  /* User Pages */
  get('/contacts', Auth.verifySessionOrRedirect, async (req, res) => {
    const [code, contacts] = await api.contact.getAll(req.session.user);
    res.status(code);
    if (!contacts) return;
    const gravatarContacts = contacts.map(user => ({
      ...user,
      gravatarLink: `http://www.gravatar.com/avatar/${md5(user.email)}.jpg`,
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
    if (req.session.user.id !== user.id) {
      const [code3, contact] = await api.contact.getOne(req.session.user, user.id);
      res.status(code3);
      if (code3 !== 200) return;
      user.isContact = contact !== undefined;
    } else {
      user.isMe = true;
    }
    res.prepareRender('user', { 
      user,
      gravatarLink: `http://www.gravatar.com/avatar/${md5(user.email)}.jpg`,
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
        gravatarLink: `http://www.gravatar.com/avatar/${md5(author.email)}.jpg`,
      };
    });
    res.prepareRender('universe', { universe, authors: authorMap });
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
    }
    console.log(req.body)
    const [code, data] = await api.universe.put(req.session.user, req.params.shortname, req.body);
    res.status(code);
    if (code === 200) return res.redirect(`${ADDR_PREFIX}/universes/${req.params.shortname}`);
    console.log(code, data)
    res.prepareRender('editUniverse', { error: data, ...req.body });
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
    res.prepareRender('item', { item, universe, tab: req.query.tab });
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
          url: `/api/universes/${item.universe_short}/items/${item.shortname}/gallery/images/${id}`,
          name,
          label,
        }));
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