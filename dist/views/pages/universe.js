"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../../config");
const api_1 = __importDefault(require("../../api"));
const templates_1 = require("../../templates");
const utils_1 = require("../../api/utils");
exports.default = {
    async list(req, res) {
        const search = req.query.search;
        const [code, universes] = await api_1.default.universe.getMany(req.session.user, search ? { strings: ['title LIKE ?'], values: [`%${search}%`] } : null, utils_1.perms.READ, {
            sort: req.query.sort,
            sortDesc: req.query.sort_order === 'desc',
        });
        res.status(code);
        if (!universes)
            return;
        res.prepareRender('universeList', { universes, search });
    },
    async create(_, res) {
        res.prepareRender('createUniverse');
    },
    async view(req, res) {
        const user = req.session.user;
        const [code1, universe] = await api_1.default.universe.getOne(user, { shortname: req.params.universeShortname });
        res.status(code1);
        if (code1 === 403 || code1 === 401) {
            const [code, publicBody] = await api_1.default.universe.getPublicBodyByShortname(req.params.universeShortname);
            if (!publicBody && code1 === 401) {
                res.status(code);
                req.forceLogin = true;
                req.useExQuery = true;
                return;
            }
            res.status(200);
            const [, request] = await api_1.default.universe.getUserAccessRequest(user, req.params.universeShortname);
            return res.prepareRender('privateUniverse', { shortname: req.params.universeShortname, hasRequested: Boolean(request), publicBody });
        }
        else if (!universe)
            return;
        const [code2, authors] = await api_1.default.user.getByUniverseShortname(user, universe.shortname);
        res.status(code2);
        if (!authors)
            return;
        const authorMap = {};
        authors.forEach(author => {
            authorMap[author.id] = {
                ...author,
                pfpUrl: (0, utils_1.getPfpUrl)(author),
            };
        });
        const [code3, threads] = await api_1.default.discussion.getThreads(user, { 'discussion.universe_id': universe.id }, false, true);
        if (!threads) {
            res.status(code3);
            return;
        }
        const [code4, counts] = await api_1.default.item.getCountsByUniverse(user, universe, false);
        if (!counts) {
            res.status(code4);
            return;
        }
        const [code5, stories] = await api_1.default.story.getMany(user, { 'story.universe_id': universe.id });
        if (!stories) {
            res.status(code5);
            return;
        }
        const [_, sponsored] = await api_1.default.user.getSponsoredUniverses(user);
        const couldUpgrade = sponsored ? (sponsored.length === 0 || sponsored
            .filter(row => row.tier > universe.tier)
            .some(row => row.universes.length < utils_1.tierAllowance[user.plan][row.tier])) : false;
        res.prepareRender('universe', { universe, authors: authorMap, threads, counts, stories, couldUpgrade });
    },
    async delete(req, res) {
        const [code, universe] = await api_1.default.universe.getOne(req.session.user, { shortname: req.params.universeShortname }, utils_1.perms.OWNER);
        res.status(code);
        if (!universe)
            return res.redirect(`${config_1.ADDR_PREFIX}/universes`);
        res.prepareRender('deleteUniverse', { universe });
    },
    async edit(req, res, error, body) {
        const [code, fetchedUniverse] = await api_1.default.universe.getOne(req.session.user, { shortname: req.params.universeShortname }, utils_1.perms.WRITE);
        res.status(code);
        if (!fetchedUniverse)
            return;
        const universe = { ...fetchedUniverse, ...(body ?? {}), shortname: fetchedUniverse.shortname, newShort: body?.shortname ?? fetchedUniverse.shortname };
        res.prepareRender('editUniverse', { universe, error });
    },
    async createDiscussionThread(req, res) {
        const [code, universe] = await api_1.default.universe.getOne(req.session.user, { shortname: req.params.universeShortname }, utils_1.perms.READ);
        if (!universe) {
            res.status(code);
            return;
        }
        if (!universe.discussion_enabled || !universe.discussion_open && universe.author_permissions[req.session.user.id] < utils_1.perms.COMMENT) {
            res.status(403);
            return;
        }
        res.prepareRender('createUniverseThread', { universe });
    },
    async discussionThread(req, res) {
        const [code1, universe] = await api_1.default.universe.getOne(req.session.user, { shortname: req.params.universeShortname });
        res.status(code1);
        if (code1 !== 200)
            return;
        const [code2, threads] = await api_1.default.discussion.getThreads(req.session.user, {
            'discussion.id': req.params.threadId,
            'universe.id': universe.id,
        });
        res.status(code2);
        if (!threads)
            return;
        if (threads.length === 0) {
            res.status(404);
            return;
        }
        const thread = threads[0];
        if (!thread)
            return;
        const [code3, comments, users] = await api_1.default.discussion.getCommentsByThread(req.session.user, thread.id, false, true);
        res.status(code3);
        if (!comments || !users)
            return;
        const commenters = {};
        for (const user of users) {
            user.pfpUrl = (0, utils_1.getPfpUrl)(user);
            delete user.email;
            commenters[user.id] = user;
        }
        res.prepareRender('universeThread', {
            universe, thread, comments, commenters,
            commentAction: `${(0, templates_1.universeLink)(req, universe.shortname)}/discuss/${thread.id}/comment`,
        });
    },
    async itemList(req, res) {
        const search = req.query.search;
        const [code1, universe] = await api_1.default.universe.getOne(req.session.user, { shortname: req.params.universeShortname });
        const [code2, items] = await api_1.default.item.getByUniverseShortname(req.session.user, req.params.universeShortname, utils_1.perms.READ, {
            sort: req.query.sort,
            sortDesc: req.query.sort_order === 'desc',
            limit: req.query.limit,
            type: req.query.type,
            tag: req.query.tag,
            search,
        });
        const code = code1 !== 200 ? code1 : code2;
        res.status(code);
        if (code !== 200)
            return;
        res.prepareRender('universeItemList', {
            items: items.map(item => ({ ...item, itemTypeName: ((universe.obj_data.cats ?? {})[item.item_type] ?? ['Missing Category'])[0] })),
            universe,
            type: req.query.type,
            tag: req.query.tag,
            search,
        });
    },
    async editPerms(req, res) {
        const [code1, universe] = await api_1.default.universe.getOne(req.session.user, { shortname: req.params.universeShortname }, utils_1.perms.ADMIN);
        const [code2, users] = await api_1.default.user.getMany();
        const [code3, contacts] = await api_1.default.contact.getAll(req.session.user, false);
        const [code4, requests] = await api_1.default.universe.getAccessRequests(req.session.user, req.params.universeShortname);
        const code = code1 !== 200 ? code1 : (code2 !== 200 ? code2 : (code3 !== 200 ? code3 : code4));
        res.status(code);
        if (code !== 200)
            return;
        contacts.forEach(contact => {
            if (!(contact.id in universe.authors)) {
                universe.authors[contact.id] = contact.username;
                universe.author_permissions[contact.id] = utils_1.perms.NONE;
            }
        });
        let ownerCount = 0;
        for (const userID in universe.author_permissions) {
            if (universe.author_permissions[userID] === utils_1.perms.OWNER)
                ownerCount++;
        }
        res.prepareRender('editUniversePerms', { universe, users, requests, ownerCount });
    },
    async upgrade(req, res) {
        const [code1, universe] = await api_1.default.universe.getOne(req.session.user, { shortname: req.params.universeShortname }, utils_1.perms.ADMIN);
        res.status(code1);
        if (!universe)
            return;
        const [code2, sponsoredData] = await api_1.default.user.getSponsoredUniverses(req.session.user);
        res.status(code2);
        if (!sponsoredData)
            return;
        const sponsored = sponsoredData.reduce((acc, row) => ({ ...acc, [row.tier]: row.universes.length }), {});
        res.prepareRender('upgradeUniverse', { universe, sponsored });
    },
};
