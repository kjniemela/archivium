"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../config");
const api_1 = __importDefault(require("../api"));
const templates_1 = require("../templates");
const utils_1 = require("../api/utils");
const logger_1 = __importDefault(require("../logger"));
const pages_1 = __importDefault(require("./pages"));
exports.default = {
    async notificationSettings(req, res) {
        const { body, session } = req;
        body['email_notifs'] = body['email_notifs'] === 'on';
        for (const type of Object.values(api_1.default.notification.types)) {
            for (const method of Object.values(api_1.default.notification.methods)) {
                body[`${type}_${method}`] = body[`notif_${type}_${method}`] === 'on';
                delete body[`notif_${type}_${method}`];
            }
        }
        const [code, data] = await api_1.default.notification.putSettings(session.user, body);
        res.status(code);
        return res.redirect(`${config_1.ADDR_PREFIX}/settings`);
    },
    async createUniverse(req, res) {
        const [code, data] = await api_1.default.universe.post(req.session.user, {
            ...req.body,
            obj_data: decodeURIComponent(req.body.obj_data),
            public: req.body.visibility === 'public',
            discussion_enabled: req.body.discussion_enabled === 'enabled',
            discussion_open: req.body.discussion_open === 'enabled',
        });
        res.status(code);
        if (code === 201)
            return res.redirect(`${(0, templates_1.universeLink)(req, req.body.shortname)}/`);
        res.prepareRender('createUniverse', { error: data, ...req.body });
    },
    async editUniverse(req, res) {
        req.body = {
            ...req.body,
            obj_data: decodeURIComponent(req.body.obj_data),
            public: req.body.visibility === 'public',
            discussion_enabled: req.body.discussion_enabled === 'enabled',
            discussion_open: req.body.discussion_open === 'enabled',
        };
        const [code, errOrId] = await api_1.default.universe.put(req.session.user, req.params.universeShortname, req.body);
        res.status(code);
        if (code !== 200) {
            await pages_1.default.universe.edit(req, res, errOrId, req.body);
            return;
        }
        else {
            const [code, universe] = await api_1.default.universe.getOne(req.session.user, { 'universe.id': errOrId }, utils_1.perms.READ);
            res.status(code);
            if (!universe)
                return;
            res.redirect(`${(0, templates_1.universeLink)(req, universe.shortname)}`);
        }
    },
    async createUniverseThread(req, res) {
        const [code1, data] = await api_1.default.discussion.postUniverseThread(req.session.user, req.params.universeShortname, { title: req.body.title });
        res.status(code1);
        if (code1 === 201) {
            if (req.body.comment) {
                const [code2, _] = await api_1.default.discussion.postCommentToThread(req.session.user, data.insertId, { body: req.body.comment });
                res.status(code2);
            }
            return res.redirect(`${(0, templates_1.universeLink)(req, req.params.universeShortname)}/discuss/${data.insertId}`);
        }
        const [code3, universe] = await api_1.default.universe.getOne(req.session.user, { shortname: req.params.universeShortname });
        res.status(code3);
        if (code3 !== 200)
            return;
        res.prepareRender('createUniverseThread', { error: data, ...req.body, universe });
    },
    async commentOnThread(req, res) {
        const [code, _] = await api_1.default.discussion.postCommentToThread(req.session.user, req.params.threadId, req.body);
        res.status(code);
        return res.redirect(`${(0, templates_1.universeLink)(req, req.params.universeShortname)}/discuss/${req.params.threadId}#post-comment`);
    },
    async createItem(req, res) {
        const [userCode, data] = await api_1.default.item.post(req.session.user, {
            ...req.body,
        }, req.params.universeShortname);
        res.status(userCode);
        if (userCode === 201)
            return res.redirect(`${(0, templates_1.universeLink)(req, req.params.universeShortname)}/items/${req.body.shortname}`);
        const [code, universe] = await api_1.default.universe.getOne(req.session.user, { shortname: req.params.universeShortname });
        res.status(code);
        if (code !== 200)
            return;
        res.prepareRender('createItem', { error: data, ...req.body, universe });
    },
    async editItem(req, res) {
        const [code, errorOrId] = await api_1.default.item.save(req.session.user, req.params.universeShortname, req.params.itemShortname, req.body);
        res.status(code);
        if (code !== 200) {
            res.error = errorOrId;
            await pages_1.default.item.edit(req, res);
            return;
        }
        else {
            const [code, item] = await api_1.default.item.getOne(req.session.user, { 'item.id': errorOrId }, utils_1.perms.READ, true);
            res.status(code);
            if (!item)
                return;
            res.redirect(`${(0, templates_1.universeLink)(req, req.params.universeShortname)}/items/${item.shortname}`);
        }
    },
    async commentOnItem(req, res) {
        const [code, _] = await api_1.default.discussion.postCommentToItem(req.session.user, req.params.universeShortname, req.params.itemShortname, req.body);
        res.status(code);
        res.redirect(`${(0, templates_1.universeLink)(req, req.params.universeShortname)}/items/${req.params.itemShortname}?tab=comments#post-comment`);
    },
    async editUniversePerms(req, res) {
        const { session, params, body } = req;
        const [_, user] = await api_1.default.user.getOne({ 'user.username': req.body.username });
        const [code] = await api_1.default.universe.putPermissions(session.user, params.universeShortname, user, body.permission_level);
        res.status(code);
        if (code !== 200)
            return;
        res.redirect(`${(0, templates_1.universeLink)(req, params.universeShortname)}/permissions`);
    },
    async sponsorUniverse(req, res) {
        const { session, params, body } = req;
        const [code] = await api_1.default.universe.putUserSponsoring(session.user, params.universeShortname, Number(body.tier));
        res.status(code);
        if (code !== 200)
            return;
        res.redirect(`${(0, templates_1.universeLink)(req, params.universeShortname)}/`);
    },
    async createNote(req, res) {
        const { body, session } = req;
        const [code, data, uuid] = await api_1.default.note.post(session.user, {
            title: body.note_title,
            public: body.note_public === 'on',
            body: body.note_body,
            tags: body.note_tags?.split(' ') ?? [],
        });
        let nextPage;
        if (body.note_item && body.note_universe) {
            const [code, data] = await api_1.default.note.linkToItem(session.user, body.note_universe, body.note_item, uuid);
            if (code !== 201) {
                logger_1.default.error(`Error ${code}: ${data}`);
                return;
            }
            nextPage = nextPage || `${(0, templates_1.universeLink)(req, body.note_universe)}/items/${body.note_item}?tab=notes&note=${uuid}`;
        }
        if (body.note_board && body.note_universe) {
            const [code, data] = await api_1.default.note.linkToBoard(session.user, body.note_board, uuid);
            if (code !== 201) {
                logger_1.default.error(`Error ${code}: ${data}`);
                return;
            }
            nextPage = nextPage || `${(0, templates_1.universeLink)(req, body.note_universe)}/notes/${body.note_board}?note=${uuid}`;
        }
        res.status(code);
        if (code === 201)
            return res.redirect(nextPage || `${config_1.ADDR_PREFIX}/notes?note=${uuid}`);
        logger_1.default.error(`Error ${code}: ${data}`);
        // res.prepareRender('createUniverse', { error: data, ...req.body });
    },
    async editNote(req, res) {
        const { body, session } = req;
        const [code, data] = await api_1.default.note.put(session.user, body.note_uuid, {
            title: body.note_title,
            public: body.note_public === 'on',
            body: body.note_body,
            items: body.items,
            boards: body.boards,
            tags: body.note_tags?.split(' ') ?? [],
        });
        let nextPage;
        if (body.note_item && body.note_universe) {
            nextPage = nextPage || `${(0, templates_1.universeLink)(req, body.note_universe)}/items/${body.note_item}?tab=notes&note=${body.note_uuid}`;
        }
        if (body.note_board && body.note_universe) {
            nextPage = nextPage || `${(0, templates_1.universeLink)(req, body.note_universe)}/notes/${body.note_board}?note=${body.note_uuid}`;
        }
        res.status(code);
        if (code === 200) {
            res.redirect(nextPage || `${config_1.ADDR_PREFIX}/notes?note=${body.note_uuid}`);
            return;
        }
        logger_1.default.error(`Error ${code}: ${data}`);
        // res.prepareRender('createUniverse', { error: data, ...req.body });
    },
    async createStory(req, res) {
        const [code, data] = await api_1.default.story.post(req.session.user, {
            ...req.body,
            public: req.body.drafts_public === 'public',
        });
        res.status(code);
        if (code === 201)
            return res.redirect(`${config_1.ADDR_PREFIX}/stories/${req.body.shortname}`);
        const [_, universes] = await api_1.default.universe.getMany(req.session.user, null, utils_1.perms.WRITE);
        res.prepareRender('createStory', { universes: universes ?? [], error: data, ...req.body });
    },
    async editStory(req, res) {
        req.body = {
            ...req.body,
            drafts_public: req.body.drafts_public === 'on',
        };
        const [code, errorOrShortname] = await api_1.default.story.put(req.session.user, req.params.shortname, req.body);
        res.status(code);
        if (code !== 200) {
            await pages_1.default.story.edit(req, res, errorOrShortname, req.body);
            return;
        }
        else {
            res.redirect(`${config_1.ADDR_PREFIX}/stories/${errorOrShortname}`);
        }
    },
    async editChapter(req, res) {
        req.body = {
            ...req.body,
            is_published: req.body.is_published === 'on',
        };
        const [code, errorOrIndex] = await api_1.default.story.putChapter(req.session.user, req.params.shortname, req.params.index, req.body);
        res.status(code);
        if (code !== 200) {
            await pages_1.default.story.editChapter(req, res, errorOrIndex, req.body);
            return;
        }
        else {
            res.redirect(`${config_1.ADDR_PREFIX}/stories/${req.params.shortname}/${errorOrIndex}`);
        }
    },
    async commentOnChapter(req, res) {
        const [code, _] = await api_1.default.discussion.postCommentToChapter(req.session.user, req.params.shortname, req.params.index, req.body);
        res.status(code);
        res.redirect(`${config_1.ADDR_PREFIX}/stories/${req.params.shortname}/${req.params.index}#post-comment`);
    },
    async passwordResetRequest(req, res) {
        const { body } = req;
        const [code, user] = await api_1.default.user.getOne({ email: body.email });
        if (user) {
            const [code2, data] = await api_1.default.email.trySendPasswordReset(user);
            if (code2 === 429) {
                return res.prepareRender('forgotPassword', { error: `Please wait ${(data.getDate() - new Date().getTime()) / 1000} seconds before trying again.` });
            }
            else {
                return res.prepareRender('forgotPassword', { success: 'Email sent!' });
            }
        }
        else {
            res.status(code);
            return res.prepareRender('forgotPassword', { error: `Error: ${code}` });
        }
    },
    async resetPassword(req, res) {
        const { body } = req;
        if (body.newPassword !== body.confirmPassword) {
            res.status(400);
            return res.prepareRender('resetPassword', { error: 'New password and confirmation do not match.' });
        }
        const [code, userId] = await api_1.default.user.resetPassword(req.params.key, body.newPassword);
        res.status(code);
        if (code === 200) {
            const [_, user] = await api_1.default.user.getOne({ id: userId });
            if (user) {
                return res.redirect(`${config_1.ADDR_PREFIX}/`);
            }
        }
        else {
            return res.prepareRender('resetPassword', { error: 'This password reset link seems to be broken or expired — try requesting a new one.' });
        }
    },
};
