const pug = require('pug');
const { ADDR_PREFIX, DOMAIN } = require('../config');
const { perms } = require('../api/utils');
const md5 = require('md5');
const path = require('path');

const locale = {
  en: {
    article: 'article',
    articles: 'articles',
    character: 'character',
    characters: 'characters',
    location: 'location',
    locations: 'locations',
    event: 'event',
    events: 'events',
    archive: 'archive',
    archives: 'archives',
    document: 'document',
    documents: 'documents',
    timeline: 'timeline',
    timelines: 'timelines',
    item: 'item',
    items: 'items',
    organization: 'organization',
    organizations: 'organizations',
    missing_cat: 'Missing Category',
    [`perms_${perms.NONE}`]: 'None',
    [`perms_${perms.READ}`]: 'Read',
    [`perms_${perms.COMMENT}`]: 'Comment',
    [`perms_${perms.WRITE}`]: 'Write',
    [`perms_${perms.ADMIN}`]: 'Admin',
  }
};

// Basic context information to be sent to the templates
function contextData(req) {
  const subdomain = req.headers['x-subdomain'];
  const user = req.session.user;
  const contextUser = user ? {
    id: user.id,
    username: user.username,
    gravatarLink: `https://www.gravatar.com/avatar/${md5(user.email)}.jpg`,
  } : null;

  const lang = 'en';

  function T(str) {
    return locale[lang][str] ?? str;
  }

  function link(url, withinSubdomain=false) {
    return `https://${withinSubdomain ? `${subdomain}.` : ''}${DOMAIN}${ADDR_PREFIX}${url}`;
  }

  const searchQueries = new URLSearchParams(req.query);
  const pageQuery = new URLSearchParams();
  pageQuery.append('page', req.path)
  if (searchQueries.toString()) pageQuery.append('search', searchQueries.toString())

  return {
    contextUser,
    ADDR_PREFIX,
    DOMAIN,
    encodedPath: pageQuery.toString(),
    searchQueries: searchQueries.toString(),
    displayUniverse: subdomain,
    perms,
    locale: locale[lang],
    link,
    T,
  };
}

const pugOptions = {
  basedir: path.join(__dirname, '..'),
};

function compile(file) {
  return pug.compileFile(file, pugOptions);
}

// compile templates
const templates = {
  error: compile('templates/error.pug'),
  docs: compile('templates/displayMd.pug'),
  home: compile('templates/home.pug'),
  login: compile('templates/login.pug'),
  signup: compile('templates/signup.pug'),

  universe: compile('templates/view/universe.pug'),
  editUniverse: compile('templates/edit/universe.pug'),
  deleteUniverse: compile('templates/delete/universe.pug'),
  universeList: compile('templates/list/universes.pug'),
  createUniverse: compile('templates/create/universe.pug'),
  editUniversePerms: compile('templates/edit/universePerms.pug'),
  universeThread: compile('templates/view/universeThread.pug'),
  createUniverseThread: compile('templates/create/universeThread.pug'),

  item: compile('templates/view/item.pug'),
  editItem: compile('templates/edit/item.pug'),
  editItemRaw: compile('templates/edit/itemRaw.pug'),
  itemList: compile('templates/list/items.pug'),
  createItem: compile('templates/create/item.pug'),

  universeItemList: compile('templates/list/universeItems.pug'),

  user: compile('templates/view/user.pug'),
  contactList: compile('templates/list/contacts.pug'),

  search: compile('templates/list/search.pug'),
};

function render(req, template, context = {}) {
  if (template in templates) return templates[template]({ ...context, ...contextData(req), curTemplate: template });
  else return templates.error({
    code: 404,
    hint: `Template ${template} not found.`,
    ...contextData(req),
    curTemplate: template,
  });
}

module.exports = {
  render,
};