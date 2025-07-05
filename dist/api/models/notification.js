"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationAPI = void 0;
const errors_1 = require("../../errors");
const { executeQuery, parseData } = require('../utils');
const { WEB_PUSH_ENABLED, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, ADDR_PREFIX, DOMAIN } = require('../../config');
const logger = require('../../logger');
const md5 = require('md5');
const webpush = require('web-push');
if (WEB_PUSH_ENABLED) {
    webpush.setVapidDetails('mailto:contact@archivium.net', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}
var methods;
(function (methods) {
    methods[methods["WEB"] = 0] = "WEB";
    methods[methods["PUSH"] = 1] = "PUSH";
    methods[methods["EMAIL"] = 2] = "EMAIL";
})(methods || (methods = {}));
;
class NotificationAPI {
    api;
    types = {
        CONTACTS: 'contacts',
        UNIVERSE: 'universe',
        COMMENTS: 'comments',
        FEATURES: 'features',
    };
    methods = methods;
    constructor(api) {
        this.api = api;
    }
    async getOne(user, endpoint) {
        const endpointHash = md5(endpoint);
        const subscription = (await executeQuery('SELECT * FROM notificationsubscription WHERE user_id = ? AND endpoint_hash = ?', [user.id, endpointHash]))[0];
        return subscription;
    }
    async getByEndpoint(endpoint) {
        const endpointHash = md5(endpoint);
        const subscription = (await executeQuery('SELECT * FROM notificationsubscription WHERE endpoint_hash = ?', [endpointHash]))[0];
        return subscription;
    }
    async getByUser(user) {
        const subscriptions = await executeQuery('SELECT * FROM notificationsubscription WHERE user_id = ?', [user.id]);
        return subscriptions;
    }
    async isSubscribed(user, subscriptionData) {
        const { endpoint } = subscriptionData;
        if (!endpoint || !user)
            return false;
        const subscription = await this.getByEndpoint(endpoint);
        return Boolean(subscription && subscription.user_id === user.id);
    }
    async subscribe(user, subscriptionData) {
        if (!user)
            throw new errors_1.UnauthorizedError();
        const { endpoint, keys } = subscriptionData;
        if (!endpoint || !keys)
            throw new errors_1.ValidationError('Missing subscription data');
        const subscription = await this.getByEndpoint(endpoint);
        const endpointHash = md5(endpoint);
        if (!subscription) {
            await executeQuery('INSERT INTO notificationsubscription (user_id, endpoint_hash, push_endpoint, push_keys) VALUES (?, ?, ?, ?)', [
                user.id,
                endpointHash,
                endpoint,
                keys,
            ]);
            logger.info(`New subscription added for ${user.username}`);
        }
        else if (subscription.user_id !== user.id) {
            await executeQuery('UPDATE notificationsubscription SET user_id = ? WHERE endpoint_hash = ?', [user.id, endpointHash]);
            logger.info(`Subscription user changed to ${user.username}`);
        }
        else {
            logger.info(`Duplicate subscription ignored for ${user.username}`);
        }
        return endpointHash;
    }
    async unsubscribe(user, subscriptionData) {
        if (!user)
            throw new errors_1.UnauthorizedError();
        const { endpoint, keys } = subscriptionData;
        if (!endpoint || !keys)
            throw new errors_1.ValidationError('Missing subscription data');
        const subscription = await this.getByEndpoint(endpoint);
        if (subscription.user_id === user.id) {
            const endpointHash = md5(endpoint);
            await executeQuery('DELETE FROM notificationsubscription WHERE user_id = ? AND endpoint_hash = ?', [user.id, endpointHash]);
            logger.info(`Unsubscribed ${user.username}`);
            return subscription;
        }
        else {
            throw new errors_1.ForbiddenError();
        }
    }
    async notify(target, notifType, message) {
        const { title, body, icon, clickUrl } = message;
        if (!title || !body)
            throw new errors_1.ValidationError('Missing notification data');
        const settings = await this.getTypeSettings(target);
        const enabledMethods = settings.filter(s => s.notif_type === notifType).reduce((acc, val) => ({ ...acc, [val.notif_method]: Boolean(val.is_enabled) }), {});
        const autoMark = enabledMethods[methods.WEB] === false;
        const { insertId } = await executeQuery('INSERT INTO sentnotification (title, body, icon_url, click_url, notif_type, user_id, sent_at, is_read) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
            title,
            body,
            icon ?? null,
            clickUrl ?? null,
            notifType,
            target.id,
            new Date(),
            autoMark,
        ]);
        const payload = JSON.stringify({ id: insertId, title, body, icon, clickUrl });
        if (WEB_PUSH_ENABLED && enabledMethods[methods.PUSH]) {
            const subscriptions = await this.getByUser(target);
            for (const { push_endpoint, push_keys } of subscriptions) {
                await webpush.sendNotification({ endpoint: push_endpoint, keys: push_keys }, payload).catch(err => {
                    logger.error(err);
                    // subscriptions.splice(index, 1); // Remove invalid subscriptions
                });
            }
        }
        if (enabledMethods[methods.EMAIL] && target.email_notifications) {
            await this.api.email.sendTemplateEmail(this.api.email.templates.NOTIFY, target.email, { title, body, icon, clickUrl: `https://${DOMAIN}${ADDR_PREFIX}${clickUrl}` });
        }
    }
    /**
     *
     * @param {*} user
     * @returns {Promise<[number, QueryResult]>}
     */
    async getSentNotifications(user) {
        if (!user)
            throw new errors_1.UnauthorizedError();
        const notifications = await executeQuery('SELECT * FROM sentnotification WHERE user_id = ? ORDER BY sent_at DESC', [user.id]);
        return notifications;
    }
    async markRead(user, id, isRead) {
        if (!(typeof isRead === 'boolean'))
            throw new errors_1.ValidationError('Invalid read status');
        if (!user)
            throw new errors_1.UnauthorizedError();
        const data = await executeQuery('UPDATE sentnotification SET is_read = ? WHERE id = ? AND user_id = ?', [isRead, id, user.id]);
        if (data.changedRows === 0)
            throw new errors_1.NotFoundError();
    }
    async markAllRead(user, isRead) {
        if (!user)
            throw new errors_1.UnauthorizedError();
        await executeQuery('UPDATE sentnotification SET is_read = ? WHERE user_id = ?', [isRead, user.id]);
    }
    async putNotificationType(user, type, method, enabled) {
        const setting = (await executeQuery('SELECT is_enabled FROM notificationtype WHERE user_id = ? AND notif_type = ? AND notif_method = ?', [user.id, type, method]))[0];
        const wasEnabled = Boolean(setting?.is_enabled);
        if (!setting) {
            await executeQuery('INSERT INTO notificationtype (user_id, notif_type, notif_method, is_enabled) VALUES (?, ?, ?, ?)', [user.id, type, method, enabled]);
        }
        else if (enabled !== wasEnabled) {
            await executeQuery('UPDATE notificationtype SET is_enabled = ? WHERE user_id = ? AND notif_type = ? AND notif_method = ?', [enabled, user.id, type, method]);
        }
    }
    async putSettings(user, changes) {
        if (!user)
            throw new errors_1.UnauthorizedError();
        if ('email_notifs' in changes) {
            await executeQuery('UPDATE user SET email_notifications = ? WHERE id = ?', [Boolean(changes.email_notifs), user.id]);
        }
        for (const type of Object.values(this.types)) {
            for (const method of Object.values(methods).filter(val => typeof val === 'number')) { // Required because of how typescript handles enums
                if (`${type}_${method}` in changes) {
                    await this.putNotificationType(user, type, method, changes[`${type}_${method}`]);
                }
            }
        }
    }
    async getTypeSettings(user) {
        if (!user)
            throw new errors_1.UnauthorizedError();
        const settings = await executeQuery('SELECT * FROM notificationtype WHERE user_id = ?', [user.id]);
        return settings;
    }
}
exports.NotificationAPI = NotificationAPI;
