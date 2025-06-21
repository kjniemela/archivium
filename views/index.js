const { ADDR_PREFIX, DEV_MODE } = require('../config');
const Auth = require('../middleware/auth');
const api = require('../api');
const md5 = require('md5');
const { render, universeLink, themes } = require('../templates');
const { perms, Cond, getPfpUrl } = require('../api/utils');
const fs = require('fs/promises');
const logger = require('../logger');
const ReCaptcha = require('../middleware/reCaptcha');
const Theme = require('../middleware/theme');

const pages = require('./pages');
const forms = require('./forms');

const sites = {
  DISPLAY: (req) => !!req.headers['x-subdomain'],
  NORMAL: (req) => !req.headers['x-subdomain'],
  ALL: () => true,
};

module.exports = function(app) {
  app.use((req, res, next) => {
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.prepareRender = (template, data={}) => {
      res.templateData = { template, data };
    };
    next();
  });

  app.use(Theme);

  const doRender = async (req, res) => {
    if (res.statusCode === 302) return; // We did a redirect, no need to render.
    if (res.statusCode === 401) { // We don't have permission to be here, redirect to login page.
      const pageQuery = new URLSearchParams();
      if (req.useExQuery) {
        pageQuery.append('page', req.query.page);
        pageQuery.append('search', req.query.search);
      } else {
        const searchQueries = new URLSearchParams(req.query);
        pageQuery.append('page', req.targetPage ?? req.path);
        if (searchQueries.toString()) pageQuery.append('search', searchQueries.toString());
      }
      if (req.params.universeShortname && !req.forceLogin) {
        return res.redirect(`${universeLink(req, req.params.universeShortname)}/?${pageQuery.toString()}`);
      } else {
        return res.redirect(`${ADDR_PREFIX}/login?${pageQuery.toString()}`);
      }
    }
    try {
      if (!res.templateData) throw `Code ${res.statusCode} returned by page handler.`;
      const { template, data } = res.templateData;
      res.end(render(req, template, data));
    } catch (err) {
      logger.error(`Error ${res.statusCode} rendered.`);
      logger.error(err);
      res.end(render(req, 'error', { code: res.statusCode }));
    }
  };

  function use(method, path, site, ...middleware) {
    const handler = middleware.pop();
    if (!(['get', 'post', 'put'].includes(method))) throw `Illegal method: ${method}`;
    app[method](`${ADDR_PREFIX}${path}`, ...middleware, async (req, res, next) => {
      if (site(req)) {
        await handler(req, res);
        await doRender(req, res);
      }
      next();
    });
  }
  const get = (...args) => use('get', ...args);
  const post = (...args) => use('post', ...args);
  const put = (...args) => use('put', ...args);

  const subdomain = (page, params) => {
    return async (req, res) => {
      req.params = { ...req.params, ...params(req.headers['x-subdomain']) };
      await page(req, res);
    };
  };

  const injectContext = (context, callback) => {
    const _get = (...args) => {
      const handler = args.pop();
      get(...args, async (req, res) => {
        await handler(req, res);
        await context(req, res);
      });
    };

    callback(_get);
  };

  // TEMPORARY redirect
  get('/help/markdown', async (_, res) => {
    res.redirect('https://github.com/HMI-Studios/archivium/wiki/Markdown-Guide');
  });

  get('/', sites.NORMAL, pages.home);

  /* Terms and Agreements */
  get('/privacy-policy', sites.ALL, pages.misc.privacyPolicy);
  get('/terms-of-service', sites.ALL, pages.misc.termsOfService);
  get('/code-of-conduct', sites.ALL, pages.misc.codeOfConduct);

  /* Help Pages */
  get('/markdown-demo', sites.ALL, pages.misc.markdownDemo);

  /* User Pages */
  get('/contacts', sites.ALL, Auth.verifySessionOrRedirect, pages.user.contactList);
  get('/users/:username', sites.ALL, pages.user.profilePage);
  get('/settings', sites.ALL, Auth.verifySessionOrRedirect, pages.user.settings);
  get('/verify', sites.ALL, pages.user.requestVerify);
  get('/verify/:key', sites.ALL, pages.user.verifyUser);
  get('/notifications', sites.ALL, Auth.verifySessionOrRedirect, pages.user.notifications);
  get('/forgot-password', sites.ALL, (_, res) => res.prepareRender('forgotPassword'));
  get('/reset-password/:key', sites.ALL,  (_, res) => res.prepareRender('resetPassword'));

  /* Misc pages */
  get('/search', sites.ALL, pages.misc.search);
  get('/news', sites.ALL, pages.misc.newsList);
  get('/news/:id', sites.ALL, pages.misc.news);

  /* Note pages */
  get('/notes', sites.ALL, Auth.verifySessionOrRedirect, pages.misc.notes);

  /* Story pages */
  get('/stories', sites.ALL, pages.story.list);
  get('/stories/create', sites.ALL, Auth.verifySessionOrRedirect, pages.story.create);
  get('/stories/:shortname', sites.ALL, pages.story.view);
  get('/stories/:shortname/edit', sites.ALL, Auth.verifySessionOrRedirect, pages.story.edit);
  get('/stories/:shortname/delete', sites.ALL, Auth.verifySessionOrRedirect, pages.story.delete);
  get('/stories/:shortname/create', sites.ALL, Auth.verifySessionOrRedirect, pages.story.createChapter);
  get('/stories/:shortname/:index', sites.ALL, pages.story.viewChapter);
  get('/stories/:shortname/:index/edit', sites.ALL, Auth.verifySessionOrRedirect, pages.story.editChapter);
  get('/stories/:shortname/:index/delete', sites.ALL, Auth.verifySessionOrRedirect, pages.story.deleteChapter);

  injectContext((req, res) => {
    if (res.templateData?.data?.universe) {
      const themeName = res.templateData.data.universe.obj_data.theme;
      const customTheme = res.templateData.data.universe.obj_data.customTheme ?? {};
      const baseTheme = themes[themeName] ?? req.theme;
      req.theme = {
        ...customTheme,
        ...baseTheme,
      };
    }
  }, (get) => {
    /* Universe Pages */
    get('/universes', sites.NORMAL, pages.universe.list);
    get('/universes/create', sites.NORMAL, Auth.verifySessionOrRedirect, pages.universe.create);
    get('/universes/:universeShortname', sites.NORMAL, pages.universe.view);
    get('/universes/:universeShortname/edit', sites.NORMAL, Auth.verifySessionOrRedirect, pages.universe.edit);
    get('/universes/:universeShortname/delete', sites.NORMAL, Auth.verifySessionOrRedirect, pages.universe.delete);
    get('/universes/:universeShortname/discuss/create', sites.NORMAL, Auth.verifySessionOrRedirect, pages.universe.createDiscussionThread);
    get('/universes/:universeShortname/discuss/:threadId', sites.NORMAL, Auth.verifySessionOrRedirect, pages.universe.discussionThread);
    get('/universes/:universeShortname/items', sites.NORMAL, pages.universe.itemList);
    get('/universes/:universeShortname/permissions', sites.NORMAL, Auth.verifySessionOrRedirect, pages.universe.editPerms);

    /* Item Pages */
    get('/items', sites.NORMAL, pages.item.list);
    get('/universes/:universeShortname/items/create', sites.NORMAL, Auth.verifySessionOrRedirect, pages.item.create);
    get('/universes/:universeShortname/items/:itemShortname', sites.NORMAL, pages.item.view);
    get('/universes/:universeShortname/items/:itemShortname/edit', sites.NORMAL, Auth.verifySessionOrRedirect, pages.item.edit);
    get('/universes/:universeShortname/items/:itemShortname/delete', sites.NORMAL, Auth.verifySessionOrRedirect, pages.item.delete);

    /* Display Mode Pages */
    get('/', sites.DISPLAY, subdomain(pages.universe.view, (sub) => ({ universeShortname: sub })));
    get('/delete', sites.DISPLAY, Auth.verifySessionOrRedirect, subdomain(pages.universe.delete, (sub) => ({ universeShortname: sub })));
    get('/edit', sites.DISPLAY, Auth.verifySessionOrRedirect, subdomain(pages.universe.edit, (sub) => ({ universeShortname: sub })));
    get('/discuss/create', sites.DISPLAY, Auth.verifySessionOrRedirect, subdomain(pages.universe.createDiscussionThread, (sub) => ({ universeShortname: sub })));
    get('/discuss/:threadId', sites.DISPLAY, subdomain(pages.universe.discussionThread, (sub) => ({ universeShortname: sub })));
    get('/permissions', sites.DISPLAY, Auth.verifySessionOrRedirect, subdomain(pages.universe.editPerms, (sub) => ({ universeShortname: sub })));
    
    get('/items', sites.DISPLAY, subdomain(pages.universe.itemList, (sub) => ({ universeShortname: sub })));
    get('/items/create', sites.DISPLAY, Auth.verifySessionOrRedirect, subdomain(pages.item.create, (sub) => ({ universeShortname: sub })));
    get('/items/:itemShortname', sites.DISPLAY, subdomain(pages.item.view, (sub) => ({ universeShortname: sub })));
    get('/items/:itemShortname/edit', sites.DISPLAY, Auth.verifySessionOrRedirect, subdomain(pages.item.edit, (sub) => ({ universeShortname: sub })));
    get('/items/:itemShortname/delete', sites.DISPLAY, Auth.verifySessionOrRedirect, subdomain(pages.item.delete, (sub) => ({ universeShortname: sub })));
  });

  // Redirect (for notification links)
  get('/universes/:universeShortname*', sites.DISPLAY, (req, res) => {
    res.redirect(`${universeLink(req, req.params.universeShortname)}${req.params[0] || '/'}`);
  });

  /* POST Handlers */
  post('/settings/notifications', sites.ALL, Auth.verifySessionOrRedirect, forms.notificationSettings);
  post('/forgot-password', sites.ALL, ReCaptcha.verifyReCaptcha, forms.passwordResetRequest);
  post('/reset-password/:key', sites.ALL, forms.resetPassword);
  post('/notes/create', sites.ALL, Auth.verifySessionOrRedirect, forms.createNote);
  post('/notes/edit', sites.ALL, Auth.verifySessionOrRedirect, forms.editNote);
  post('/stories/create', sites.ALL, Auth.verifySessionOrRedirect, forms.createStory);
  post('/stories/:shortname/edit', sites.ALL, Auth.verifySessionOrRedirect, forms.editStory);
  post('/stories/:shortname/:index/edit', sites.ALL, Auth.verifySessionOrRedirect, forms.editChapter);
  post('/stories/:shortname/:index/comment', sites.ALL, Auth.verifySessionOrRedirect, forms.commentOnChapter);
  post('/universes/create', sites.NORMAL, Auth.verifySessionOrRedirect, forms.createUniverse);
  post('/universes/:universeShortname/edit', sites.NORMAL, Auth.verifySessionOrRedirect, forms.editUniverse);
  post('/universes/:universeShortname/discuss/create', sites.NORMAL, Auth.verifySessionOrRedirect, forms.createUniverseThread);
  post('/universes/:universeShortname/discuss/:threadId/comment', sites.NORMAL, Auth.verifySessionOrRedirect, forms.commentOnThread);
  post('/universes/:universeShortname/permissions', sites.NORMAL, Auth.verifySessionOrRedirect, forms.editUniversePerms);
  post('/universes/:universeShortname/items/create', sites.NORMAL, Auth.verifySessionOrRedirect, forms.createItem);
  post('/universes/:universeShortname/items/:itemShortname/edit', sites.NORMAL, Auth.verifySessionOrRedirect, forms.editItem);
  post('/universes/:universeShortname/items/:itemShortname/comment', sites.NORMAL, Auth.verifySessionOrRedirect, forms.commentOnItem);

  post('/edit', sites.DISPLAY, Auth.verifySessionOrRedirect, subdomain(forms.editUniverse, (sub) => ({ universeShortname: sub })));
  post('/discuss/create', sites.DISPLAY, Auth.verifySessionOrRedirect, subdomain(forms.createUniverseThread, (sub) => ({ universeShortname: sub })));
  post('/discuss/:threadId/comment', sites.DISPLAY, Auth.verifySessionOrRedirect, subdomain(forms.commentOnThread, (sub) => ({ universeShortname: sub })));
  post('/permissions', sites.DISPLAY, Auth.verifySessionOrRedirect, subdomain(forms.editUniversePerms, (sub) => ({ universeShortname: sub })));
  post('/items/create', sites.DISPLAY, Auth.verifySessionOrRedirect, subdomain(forms.createItem, (sub) => ({ universeShortname: sub })));
  post('/items/:itemShortname/edit', sites.DISPLAY, Auth.verifySessionOrRedirect, subdomain(forms.editItem, (sub) => ({ universeShortname: sub })));
  post('/items/:itemShortname/comment', sites.DISPLAY, Auth.verifySessionOrRedirect, subdomain(forms.commentOnItem, (sub) => ({ universeShortname: sub })));
}
