import { MailerSend, EmailParams, Recipient, Sender } from 'mailersend';
import { DOMAIN, ADDR_PREFIX, DEV_MODE, MAILERSEND_API_KEY } from '../../config';
import logger from '../../logger';
import { executeQuery, Result } from '../utils';
import fs from 'fs';
import path from 'path';
import mjml from 'mjml';
import Handlebars from 'handlebars';
import { API } from '..';

const renderTemplate = (templateName, data) => {
  const templatePath = path.join(__dirname, '../../mjml', `${templateName}.mjml`);
  const mjmlRaw = fs.readFileSync(templatePath, 'utf-8');
  const mjmlPopulated = Handlebars.compile(mjmlRaw)(data);
  const html = mjml(mjmlPopulated, { minify: true }).html;
  return html;
};

export class EmailAPI {
  readonly api: API;
  readonly mailerSend?: MailerSend;
  readonly templates: { [key: string]: [string, string, string] } = {
    VERIFY: ['confirm', 'verify', 'Account Verification'],
    NOTIFY: ['notification', 'notify', 'Notification'],
    DELETE: ['delete', 'delete', 'User Delete Request'],
    RESET:  ['passwordReset', 'reset', 'Password Reset'],
  } as const;

  constructor(api: API) {
    this.api = api;
    if (MAILERSEND_API_KEY) {
      this.mailerSend = new MailerSend({
        apiKey: MAILERSEND_API_KEY,
      });
    }
  }

  private async _send(params: EmailParams) {
    if (!this.mailerSend) throw new Error('Email sending disabled!');
    await this.mailerSend.email.send(params);
  }

  async sendEmail(topic, toList, options) {
    const { from, fromName, subject, text, template, templateData } = options;
    const html = template && renderTemplate(template, templateData);
    logger.info(`Sending email to ${toList.join(', ')}...`);
    if (DEV_MODE) {
      logger.warn('Email sending may be disabled in test env.');
    }
    try {
      const emailParams = new EmailParams()
        .setFrom(new Sender(from ?? 'contact@archivium.net', fromName ?? 'Archivium Team'))
        .setTo(toList.map(to => new Recipient(to)))
        .setSubject(subject);
        
      if (text) emailParams.setText(text);
      if (html) emailParams.setHtml(html);

      try {
        await this._send(emailParams);
      } catch (error) {
        if (error.body) {
          logger.error(JSON.stringify(error.body));
        }
      }
      logger.info('Email sent!');
      for (const to of toList) {
        await executeQuery('INSERT INTO sentemail (recipient, topic, sent_at) VALUES (?, ?, ?);', [to, topic, new Date()]);
      }
    } catch (error) {
      logger.error(error);
    }
  }

  async sendTemplateEmail([template, topic, subject], to, templateData, options={}) {
    if (!(to instanceof Array)) to = [to];
    await this.sendEmail(topic, to, {
      subject,
      ...options,
      template,
      templateData,
    });
  }

  async sendVerifyLink({ id, username, email }) {
    const verificationKey = await this.api.user.prepareVerification(id);
    if (DEV_MODE) {
      // Can't send emails in dev mode, just auto-verify them instead.
      await this.api.user.verifyUser(verificationKey);
      return true;
    }
    
    const verifyEmailLink = `https://${DOMAIN}${ADDR_PREFIX}/verify/${verificationKey}`;
    await this.sendTemplateEmail(this.templates.VERIFY, email, { username, verifyEmailLink });
    return false;
  }

  async trySendVerifyLink(sessionUser, username): Result<Date | { alreadyVerified: boolean }> {
    if (!sessionUser) return [401];
    if (sessionUser.username != username) return [403];
    if (sessionUser.verified) return [200, { alreadyVerified: true }];

    const now = new Date();
    const timeout = 60 * 1000;
    const cutoff = new Date(now.getTime() - timeout);
    const recentEmails = await executeQuery(
      'SELECT * FROM sentemail WHERE recipient = ? AND topic = ? AND sent_at >= ? ORDER BY sent_at DESC;',
      [sessionUser.email, 'verify', cutoff],
    );
    if (recentEmails.length > 0) return [429, new Date(recentEmails[0].sent_at.getTime() + timeout)];

    const alreadyVerified = await this.sendVerifyLink(sessionUser);

    return [200, { alreadyVerified }];
  }

  async sendPasswordReset({ id, username, email }) {
    const resetKey = await this.api.user.preparePasswordReset(id);
    
    const resetPasswordLink = `https://${DOMAIN}${ADDR_PREFIX}/reset-password/${resetKey}`;
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
    const recentEmails = await executeQuery(
      'SELECT * FROM sentemail WHERE recipient = ? AND topic = ? AND sent_at >= ? ORDER BY sent_at DESC;',
      [user.email, 'reset', cutoff],
    );
    if (recentEmails.length > 0) return [429, new Date(recentEmails[0].sent_at.getTime() + timeout)];

    await this.sendPasswordReset(user);

    return [200];
  }
}
