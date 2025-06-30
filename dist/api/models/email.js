"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailAPI = void 0;
const mailersend_1 = require("mailersend");
const config_1 = require("../../config");
const logger_1 = __importDefault(require("../../logger"));
const utils_1 = require("../utils");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const mjml_1 = __importDefault(require("mjml"));
const handlebars_1 = __importDefault(require("handlebars"));
const renderTemplate = (templateName, data) => {
    const templatePath = path_1.default.join(__dirname, '../../mjml', `${templateName}.mjml`);
    const mjmlRaw = fs_1.default.readFileSync(templatePath, 'utf-8');
    const mjmlPopulated = handlebars_1.default.compile(mjmlRaw)(data);
    const html = (0, mjml_1.default)(mjmlPopulated, { minify: true }).html;
    return html;
};
class EmailAPI {
    api;
    mailerSend;
    templates = {
        VERIFY: ['confirm', 'verify', 'Account Verification'],
        NOTIFY: ['notification', 'notify', 'Notification'],
        DELETE: ['delete', 'delete', 'User Delete Request'],
        RESET: ['passwordReset', 'reset', 'Password Reset'],
    };
    constructor(api) {
        this.api = api;
        if (config_1.MAILERSEND_API_KEY) {
            this.mailerSend = new mailersend_1.MailerSend({
                apiKey: config_1.MAILERSEND_API_KEY,
            });
        }
    }
    async _send(params) {
        if (!this.mailerSend)
            throw new Error('Email sending disabled!');
        await this.mailerSend.email.send(params);
    }
    async sendEmail(topic, toList, options) {
        const { from, fromName, subject, text, template, templateData } = options;
        const html = template && renderTemplate(template, templateData);
        logger_1.default.info(`Sending email to ${toList.join(', ')}...`);
        if (config_1.DEV_MODE) {
            logger_1.default.warn('Email sending may be disabled in test env.');
        }
        try {
            const emailParams = new mailersend_1.EmailParams()
                .setFrom(new mailersend_1.Sender(from ?? 'contact@archivium.net', fromName ?? 'Archivium Team'))
                .setTo(toList.map(to => new mailersend_1.Recipient(to)))
                .setSubject(subject);
            if (text)
                emailParams.setText(text);
            if (html)
                emailParams.setHtml(html);
            try {
                await this._send(emailParams);
            }
            catch (error) {
                if (error.body) {
                    logger_1.default.error(JSON.stringify(error.body));
                }
            }
            logger_1.default.info('Email sent!');
            for (const to of toList) {
                await (0, utils_1.executeQuery)('INSERT INTO sentemail (recipient, topic, sent_at) VALUES (?, ?, ?);', [to, topic, new Date()]);
            }
        }
        catch (error) {
            logger_1.default.error(error);
        }
    }
    async sendTemplateEmail([template, topic, subject], to, templateData, options = {}) {
        if (!(to instanceof Array))
            to = [to];
        await this.sendEmail(topic, to, {
            subject,
            ...options,
            template,
            templateData,
        });
    }
    async sendVerifyLink({ id, username, email }) {
        const verificationKey = await this.api.user.prepareVerification(id);
        if (config_1.DEV_MODE) {
            // Can't send emails in dev mode, just auto-verify them instead.
            await this.api.user.verifyUser(verificationKey);
            return true;
        }
        const verifyEmailLink = `https://${config_1.DOMAIN}${config_1.ADDR_PREFIX}/verify/${verificationKey}`;
        await this.sendTemplateEmail(this.templates.VERIFY, email, { username, verifyEmailLink });
        return false;
    }
    async trySendVerifyLink(sessionUser, username) {
        if (!sessionUser)
            return [401];
        if (sessionUser.username != username)
            return [403];
        if (sessionUser.verified)
            return [200, { alreadyVerified: true }];
        const now = new Date();
        const timeout = 60 * 1000;
        const cutoff = new Date(now.getTime() - timeout);
        const recentEmails = await (0, utils_1.executeQuery)('SELECT * FROM sentemail WHERE recipient = ? AND topic = ? AND sent_at >= ? ORDER BY sent_at DESC;', [sessionUser.email, 'verify', cutoff]);
        if (recentEmails.length > 0)
            return [429, new Date(recentEmails[0].sent_at.getTime() + timeout)];
        const alreadyVerified = await this.sendVerifyLink(sessionUser);
        return [200, { alreadyVerified }];
    }
    async sendPasswordReset({ id, username, email }) {
        const resetKey = await this.api.user.preparePasswordReset(id);
        const resetPasswordLink = `https://${config_1.DOMAIN}${config_1.ADDR_PREFIX}/reset-password/${resetKey}`;
        await this.sendTemplateEmail(this.templates.RESET, email, { username, resetPasswordLink });
    }
    /**
     *
     * @param {*} user
     * @returns {Promise<[number, Date]>}
     */
    async trySendPasswordReset(user) {
        const now = new Date();
        const timeout = 60 * 1000;
        const cutoff = new Date(now.getTime() - timeout);
        const recentEmails = await (0, utils_1.executeQuery)('SELECT * FROM sentemail WHERE recipient = ? AND topic = ? AND sent_at >= ? ORDER BY sent_at DESC;', [user.email, 'reset', cutoff]);
        if (recentEmails.length > 0)
            return [429, new Date(recentEmails[0].sent_at.getTime() + timeout)];
        await this.sendPasswordReset(user);
        return [200];
    }
}
exports.EmailAPI = EmailAPI;
