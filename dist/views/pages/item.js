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
        let item;
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
        if (item.gallery.length > 0) {
            item.gallery = item.gallery.sort((a, b) => a.id > b.id ? 1 : -1);
        }
        if ('body' in item.obj_data && typeof item.obj_data.body !== 'string') {
            try {
                const jsonBody = (0, tiptapHelpers_1.indexedToJson)(item.obj_data.body);
                const htmlBody = (0, html_string_1.renderToHTMLString)({ extensions: editor_1.editorExtensions, content: jsonBody });
                const sanitizedHtml = (0, sanitize_html_1.default)(htmlBody, {
                    allowedTags: sanitize_html_1.default.defaults.allowedTags.concat(['img']),
                    allowedAttributes: {
                        ...sanitize_html_1.default.defaults.allowedAttributes,
                        img: ['src', 'alt', 'title'],
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
    async editLegacy(req, res) {
        const fetchedItem = await api_1.default.item.getByUniverseAndItemShortnames(req.session.user, req.params.universeShortname, req.params.itemShortname, utils_1.perms.WRITE);
        const item = { ...fetchedItem, ...(req.body ?? {}), shortname: fetchedItem.shortname, newShort: req.body?.shortname ?? fetchedItem.shortname };
        const itemList = await api_1.default.item.getByUniverseId(req.session.user, item.universe_id, utils_1.perms.READ, { type: 'character' });
        const universe = await api_1.default.universe.getOne(req.session.user, { shortname: req.params.universeShortname });
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
    async edit(req, res) {
        res.prepareRender('editor', { itemShort: req.params.itemShortname, universeShort: req.params.universeShortname });
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
