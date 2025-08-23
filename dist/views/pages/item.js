"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const html_string_1 = require("@tiptap/static-renderer/pm/html-string");
const sanitize_html_1 = __importDefault(require("sanitize-html"));
const api_1 = __importDefault(require("../../api"));
const utils_1 = require("../../api/utils");
const errors_1 = require("../../errors");
const tiptapHelpers_1 = require("../../lib/tiptapHelpers");
const logger_1 = __importDefault(require("../../logger"));
const templates_1 = require("../../templates");
const editor_1 = require("../../lib/editor");
exports.default = {
    async list(req, res) {
        const search = req.getQueryParam('search');
        const universes = await api_1.default.universe.getMany(req.session.user);
        const items = await api_1.default.item.getMany(req.session.user, null, Math.max(utils_1.perms.READ, Number(req.query.perms)) || utils_1.perms.READ, {
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
        const universe = await api_1.default.universe.getOne(req.session.user, { shortname: req.params.universeShortname }, utils_1.perms.WRITE);
        res.prepareRender('createItem', { universe, item_type: req.query.type, shortname: req.query.shortname });
    },
    async view(req, res) {
        const universe = await api_1.default.universe.getOne(req.session.user, { shortname: req.params.universeShortname });
        let item; // TODO this is ugly
        try {
            item = await api_1.default.item.getByUniverseAndItemShortnames(req.session.user, req.params.universeShortname, req.params.itemShortname);
        }
        catch (err) {
            if (err instanceof errors_1.ForbiddenError) {
                if (req.session.user && universe.author_permissions[req.session.user.id] >= utils_1.perms.READ) {
                    res.status(404);
                    res.prepareRender('error', {
                        code: 404,
                        hint: 'Looks like this item doesn\'t exist yet. Follow the link below to create it:',
                        hintLink: `${(0, templates_1.universeLink)(req, req.params.universeShortname)}/items/create?shortname=${req.params.itemShortname}`,
                    });
                    return;
                }
            }
            throw err;
        }
        item.obj_data = JSON.parse(item.obj_data);
        item.itemTypeName = ((universe.obj_data['cats'] ?? {})[item.item_type] ?? ['Missing Category'])[0];
        item.itemTypeColor = ((universe.obj_data['cats'] ?? {})[item.item_type] ?? [, , '#f3f3f3'])[2];
        if (item.gallery && item.gallery.length > 0) {
            item.gallery = item.gallery.sort((a, b) => a.id > b.id ? 1 : -1);
        }
        if ('body' in item.obj_data && typeof item.obj_data.body !== 'string') {
            try {
                const links = [];
                const headings = [];
                const jsonBody = (0, tiptapHelpers_1.indexedToJson)(item.obj_data.body, (href) => links.push((0, editor_1.extractLinkData)(href)), (title, level) => headings.push({ title, level }));
                const itemsPerUniverse = {};
                /* Because Tiptap rendering cannot be async, we extract the links we'll need to check ahead of time. */
                await Promise.all(links.map(async (link) => {
                    if (link.item) {
                        const universeShort = link.universe ?? universe.shortname;
                        if (!(universeShort in itemsPerUniverse)) {
                            itemsPerUniverse[universeShort] = {};
                        }
                        if (!(link.item in itemsPerUniverse[universeShort])) {
                            itemsPerUniverse[universeShort][link.item] = await api_1.default.item.exists(req.session.user, universeShort, link.item);
                        }
                    }
                }));
                const renderContext = {
                    currentUniverse: universe.shortname,
                    universeLink: (universeShort) => (0, templates_1.universeLink)(req, universeShort),
                    itemExists: (universe, item) => (universe in itemsPerUniverse) && itemsPerUniverse[universe][item],
                    headings,
                };
                const htmlBody = (0, html_string_1.renderToHTMLString)({ extensions: (0, editor_1.editorExtensions)(false, renderContext), content: jsonBody });
                const sanitizedHtml = (0, sanitize_html_1.default)(htmlBody, {
                    allowedTags: sanitize_html_1.default.defaults.allowedTags.concat(['img']),
                    allowedAttributes: {
                        ...sanitize_html_1.default.defaults.allowedAttributes,
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
            }
            catch (err) {
                logger_1.default.error('Failed to parse item body:', err);
                item.obj_data.body = '';
            }
        }
        const [comments, commentUsers] = await api_1.default.discussion.getCommentsByItem(item.id, true);
        const commenters = {};
        for (const user of commentUsers) {
            user.pfpUrl = (0, utils_1.getPfpUrl)(user);
            delete user.email;
            commenters[user.id] = user;
        }
        const [notes, noteUsers] = await api_1.default.note.getByItemShortname(req.session.user, universe.shortname, item.shortname, {}, {}, true);
        const noteAuthors = {};
        for (const user of noteUsers) {
            user.pfpUrl = (0, utils_1.getPfpUrl)(user);
            delete user.email;
            noteAuthors[user.id] = user;
        }
        res.prepareRender('item', {
            item, universe, tab: req.query.tab, comments, commenters, notes, noteAuthors,
            commentAction: `${(0, templates_1.universeLink)(req, universe.shortname)}/items/${item.shortname}/comment`,
            noteBaseRoute: `/api/universes/${universe.shortname}/items/${item.shortname}/notes`,
        });
    },
    async delete(req, res) {
        try {
            const item = await api_1.default.item.getByUniverseAndItemShortnames(req.session.user, req.params.universeShortname, req.params.itemShortname, utils_1.perms.OWNER);
            res.prepareRender('deleteItem', { item });
        }
        catch (err) {
            if (err instanceof errors_1.NotFoundError) {
                return res.redirect(`${(0, templates_1.universeLink)(req, req.params.universeShortname)}/items`);
            }
            throw err;
        }
    },
};
