"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.universeLink = universeLink;
exports.render = render;
const pug_1 = __importDefault(require("pug"));
const config_1 = require("./config");
const utils_1 = require("./api/utils");
const locale_1 = require("./locale");
const api_1 = __importDefault(require("./api"));
const themes_1 = __importDefault(require("./themes"));
const logger_1 = __importDefault(require("./logger"));
function universeLink(req, uniShort) {
    const displayUniverse = req.headers['x-subdomain'];
    if (displayUniverse) {
        if (displayUniverse === uniShort)
            return config_1.ADDR_PREFIX;
        else
            return `https://${config_1.DOMAIN}${config_1.ADDR_PREFIX}/universes/${uniShort}`;
    }
    else {
        return `${config_1.ADDR_PREFIX}/universes/${uniShort}`;
    }
}
// Basic context information to be sent to the templates
function contextData(req) {
    const user = req.session.user;
    const contextUser = user ? {
        id: user.id,
        username: user.username,
        notifications: user.notifications,
        plan: user.plan,
        pfpUrl: (0, utils_1.getPfpUrl)(user),
        maxTier: Math.max(...Object.keys(utils_1.tierAllowance[user.plan] || {}).filter(k => k !== 'total').map(k => Number(k))),
    } : null;
    const searchQueries = new URLSearchParams(req.query);
    const pageQuery = new URLSearchParams();
    pageQuery.append('page', req.path);
    if (searchQueries.toString())
        pageQuery.append('search', searchQueries.toString());
    return {
        contextUser,
        DOMAIN: config_1.DOMAIN,
        ADDR_PREFIX: config_1.ADDR_PREFIX,
        VAPID_PUBLIC_KEY: config_1.VAPID_PUBLIC_KEY,
        encodedPath: pageQuery.toString(),
        displayUniverse: req.headers['x-subdomain'],
        universeLink: universeLink.bind(null, req),
        searchQueries: searchQueries.toString(),
        perms: utils_1.perms,
        locale: locale_1.locale[locale_1.lang],
        themes: themes_1.default,
        theme: req.theme ?? themes_1.default.default,
        plans: utils_1.plans,
        tiers: utils_1.tiers,
        tierAllowance: utils_1.tierAllowance,
        T: locale_1.T,
        sprintf: locale_1.sprintf,
        validateUsername: api_1.default.user.validateUsername,
        validateShortname: api_1.default.universe.validateShortname,
    };
}
const pugOptions = {
    basedir: __dirname,
};
function compile(file) {
    return pug_1.default.compileFile(file, pugOptions);
}
// compile templates
logger_1.default.info('Compiling templates...');
const templates = {
    error: compile('templates/error.pug'),
    docs: compile('templates/displayMd.pug'),
    home: compile('templates/home.pug'),
    login: compile('templates/login.pug'),
    signup: compile('templates/signup.pug'),
    markdownDemo: compile('templates/view/markdownDemo.pug'),
    universe: compile('templates/view/universe.pug'),
    editUniverse: compile('templates/edit/universe.pug'),
    deleteUniverse: compile('templates/delete/universe.pug'),
    universeList: compile('templates/list/universes.pug'),
    createUniverse: compile('templates/create/universe.pug'),
    editUniversePerms: compile('templates/edit/universePerms.pug'),
    upgradeUniverse: compile('templates/edit/universeUpgrade.pug'),
    privateUniverse: compile('templates/view/privateUniverse.pug'),
    universeThread: compile('templates/view/universeThread.pug'),
    createUniverseThread: compile('templates/create/universeThread.pug'),
    story: compile('templates/view/story.pug'),
    editStory: compile('templates/edit/story.pug'),
    deleteStory: compile('templates/delete/story.pug'),
    storyList: compile('templates/list/stories.pug'),
    createStory: compile('templates/create/story.pug'),
    chapter: compile('templates/view/chapter.pug'),
    editChapter: compile('templates/edit/chapter.pug'),
    deleteChapter: compile('templates/delete/chapter.pug'),
    item: compile('templates/view/item.pug'),
    editItem: compile('templates/edit/item.pug'),
    deleteItem: compile('templates/delete/item.pug'),
    itemList: compile('templates/list/items.pug'),
    createItem: compile('templates/create/item.pug'),
    universeItemList: compile('templates/list/universeItems.pug'),
    user: compile('templates/view/user.pug'),
    contactList: compile('templates/list/contacts.pug'),
    search: compile('templates/list/search.pug'),
    news: compile('templates/list/news.pug'),
    notes: compile('templates/list/notes.pug'),
    verify: compile('templates/verify.pug'),
    settings: compile('templates/edit/settings.pug'),
    spamblock: compile('templates/spamblock.pug'),
    notifications: compile('templates/view/notifications.pug'),
    forgotPassword: compile('templates/edit/forgotPassword.pug'),
    resetPassword: compile('templates/edit/resetPassword.pug'),
    editor: compile('templates/editor.pug'),
};
function render(req, template, context = {}) {
    if (template in templates)
        return templates[template]({ ...context, ...contextData(req), curTemplate: template });
    else
        return templates.error({
            code: 404,
            hint: `Template ${template} not found.`,
            ...contextData(req),
            curTemplate: template,
        });
}
