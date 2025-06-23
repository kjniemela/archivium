"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../../config");
const api_1 = __importDefault(require("../../api"));
const md5_1 = __importDefault(require("md5"));
const utils_1 = require("../../api/utils");
exports.default = {
    /* User Pages */
    async contactList(req, res) {
        const [code, contacts] = await api_1.default.contact.getAll(req.session.user);
        res.status(code);
        if (!contacts)
            return;
        const gravatarContacts = contacts.map(user => ({
            ...user,
            pfpUrl: (0, utils_1.getPfpUrl)(user),
        }));
        res.prepareRender('contactList', {
            contacts: gravatarContacts.filter(contact => contact.accepted),
            pending: gravatarContacts.filter(contact => !contact.accepted),
        });
    },
    async profilePage(req, res) {
        const [code1, user] = await api_1.default.user.getOne({ 'user.username': req.params.username });
        res.status(code1);
        if (!user)
            return;
        const [code2, universes] = await api_1.default.universe.getManyByAuthorId(req.session.user, user.id);
        res.status(code2);
        if (!universes)
            return;
        const [code3, recentlyUpdated] = await api_1.default.item.getMany(req.session.user, null, utils_1.perms.READ, {
            sort: 'updated_at',
            sortDesc: true,
            limit: 15,
            select: [['lub.username', 'last_updated_by']],
            join: [['LEFT', ['user', 'lub'], new utils_1.Cond('lub.id = item.last_updated_by')]],
            where: new utils_1.Cond('item.author_id = ?', user.id)
                .and(new utils_1.Cond('lub.id = ?', user.id).or('item.last_updated_by IS NULL')),
        });
        res.status(code3);
        const [code4, items] = await api_1.default.item.getByAuthorUsername(req.session.user, user.username, utils_1.perms.READ, {
            sort: 'updated_at',
            sortDesc: true,
            limit: 15
        });
        res.status(code4);
        if (!items)
            return;
        if (req.session.user?.id !== user.id) {
            const [_, contact] = await api_1.default.contact.getOne(req.session.user, user.id);
            user.isContact = contact !== undefined;
        }
        else {
            user.isMe = true;
        }
        res.prepareRender('user', {
            user,
            items,
            pfpUrl: (0, utils_1.getPfpUrl)(user),
            universes,
            recentlyUpdated,
        });
    },
    async settings(req, res) {
        const [code, user] = await api_1.default.user.getOne({ 'user.id': req.session.user.id });
        res.status(code);
        if (!user)
            return;
        const [code2, typeSettingData] = await api_1.default.notification.getTypeSettings(user);
        res.status(code2);
        if (!typeSettingData)
            return;
        const typeSettings = {};
        for (const setting of typeSettingData) {
            typeSettings[`${setting.notif_type}_${setting.notif_method}`] = Boolean(setting.is_enabled);
        }
        const [, deleteRequest] = await api_1.default.user.getDeleteRequest(user);
        res.prepareRender('settings', {
            user,
            typeSettings,
            deleteRequest,
            notificationTypes: api_1.default.notification.types,
            notificationMethods: api_1.default.notification.methods,
        });
    },
    async requestVerify(req, res) {
        if (!req.session.user) {
            res.status(401);
            return;
        }
        if (req.session.user.verified) {
            res.redirect(`${config_1.ADDR_PREFIX}/`);
            return;
        }
        const [code, data] = await api_1.default.email.trySendVerifyLink(req.session.user, req.session.user.username);
        if (data && data.alreadyVerified) {
            res.redirect(`${config_1.ADDR_PREFIX}${req.query.page || '/'}${req.query.search ? `?${req.query.search}` : ''}`);
            return;
        }
        res.prepareRender('verify', {
            user: req.session.user,
            gravatarLink: `https://www.gravatar.com/avatar/${(0, md5_1.default)(req.session.user.email)}.jpg`,
            nextPage: `${req.query.page || '/'}${req.query.search ? `?${req.query.search}` : ''}`,
            reason: req.query.reason,
        });
    },
    async verifyUser(req, res) {
        const [code, userId] = await api_1.default.user.verifyUser(req.params.key);
        res.status(code);
        if (code === 200) {
            const [_, user] = await api_1.default.user.getOne({ id: userId });
            if (user) {
                // TODO should we send a welcome email?
                // api.email.sendTemplateEmail(api.email.templates.WELCOME, req.body.email, { username: user.username });
                return res.redirect(`${config_1.ADDR_PREFIX}/`);
            }
        }
        else {
            return res.redirect(`${config_1.ADDR_PREFIX}/verify?reason=bad_key`);
        }
    },
    async notifications(req, res) {
        if (req.session.user) {
            const [code, notifications] = await api_1.default.notification.getSentNotifications(req.session.user);
            res.status(code);
            if (!notifications)
                return;
            res.prepareRender('notifications', {
                read: notifications.filter(notif => notif.is_read),
                unread: notifications.filter(notif => !notif.is_read),
            });
        }
    },
};
