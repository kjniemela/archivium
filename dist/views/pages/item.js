"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = __importDefault(require("../../api"));
const templates_1 = require("../../templates");
const utils_1 = require("../../api/utils");
exports.default = {
    async list(req, res) {
        const search = req.query.search;
        const [code1, universes] = await api_1.default.universe.getMany(req.session.user);
        const [code2, items] = await api_1.default.item.getMany(req.session.user, null, Math.max(utils_1.perms.READ, Number(req.query.perms)) || utils_1.perms.READ, {
            sort: req.query.sort,
            sortDesc: req.query.sort_order === 'desc',
            limit: req.query.limit,
            type: req.query.type,
            tag: req.query.tag,
            universe: req.query.universe,
            author: req.query.author,
            search,
        });
        const code = code1 !== 200 ? code1 : code2;
        res.status(code);
        if (code !== 200)
            return;
        const universeCats = universes.reduce((cats, universe) => {
            universe.obj_data = JSON.parse(universe.obj_data);
            return { ...cats, [universe.id]: universe.obj_data.cats };
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
        const [code, universe] = await api_1.default.universe.getOne(req.session.user, { shortname: req.params.universeShortname }, utils_1.perms.WRITE);
        res.status(code);
        if (code !== 200)
            return;
        res.prepareRender('createItem', { universe, item_type: req.query.type, shortname: req.query.shortname });
    },
    async view(req, res) {
        const [code1, universe] = await api_1.default.universe.getOne(req.session.user, { shortname: req.params.universeShortname });
        const [code2, item] = await api_1.default.item.getByUniverseAndItemShortnames(req.session.user, req.params.universeShortname, req.params.itemShortname);
        res.status(code1);
        if (code1 !== 200)
            return;
        if (!item) {
            if (universe.author_permissions[req.session.user?.id] >= utils_1.perms.READ) {
                res.status(404);
                res.prepareRender('error', {
                    code: 404,
                    hint: 'Looks like this item doesn\'t exist yet. Follow the link below to create it:',
                    hintLink: `${(0, templates_1.universeLink)(req, req.params.universeShortname)}/items/create?shortname=${req.params.itemShortname}`,
                });
            }
            else {
                res.status(code2);
            }
            return;
        }
        item.obj_data = JSON.parse(item.obj_data);
        item.itemTypeName = ((universe.obj_data.cats ?? {})[item.item_type] ?? ['Missing Category'])[0];
        item.itemTypeColor = ((universe.obj_data.cats ?? {})[item.item_type] ?? [, , '#f3f3f3'])[2];
        if (item.gallery.length > 0) {
            item.gallery = item.gallery.sort((a, b) => a.id > b.id ? 1 : -1);
        }
        const [code3, comments, commentUsers] = await api_1.default.discussion.getCommentsByItem(item.id, true);
        if (!comments || !commentUsers) {
            res.status(code3);
            return;
        }
        const commenters = {};
        for (const user of commentUsers) {
            user.pfpUrl = (0, utils_1.getPfpUrl)(user);
            delete user.email;
            commenters[user.id] = user;
        }
        const [code4, notes, noteUsers] = await api_1.default.note.getByItemShortname(req.session.user, universe.shortname, item.shortname, {}, {}, true);
        if (!notes || !noteUsers) {
            res.status(code4);
            return;
        }
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
    async edit(req, res) {
        const [code1, fetchedItem] = await api_1.default.item.getByUniverseAndItemShortnames(req.session.user, req.params.universeShortname, req.params.itemShortname, utils_1.perms.WRITE);
        res.status(code1);
        if (!fetchedItem)
            return;
        const item = { ...fetchedItem, ...(req.body ?? {}), shortname: fetchedItem.shortname, newShort: req.body?.shortname ?? fetchedItem.shortname };
        const [code2, itemList] = await api_1.default.item.getByUniverseId(req.session.user, item.universe_id, utils_1.perms.READ, { type: 'character' });
        res.status(code2);
        if (code2 !== 200)
            return;
        const [code3, universe] = await api_1.default.universe.getOne(req.session.user, { shortname: req.params.universeShortname });
        res.status(code3);
        if (code3 !== 200)
            return;
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
        const [code, item] = await api_1.default.item.getByUniverseAndItemShortnames(req.session.user, req.params.universeShortname, req.params.itemShortname, utils_1.perms.OWNER);
        res.status(code);
        if (!item)
            return res.redirect(`${(0, templates_1.universeLink)(req, req.params.universeShortname)}/items`);
        res.prepareRender('deleteItem', { item });
    },
};
