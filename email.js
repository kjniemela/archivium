const { SENDGRID_API_KEY } = require('./config');
const logger = require('./logger');

const templates = {
  VERIFY: 'd-04ac9be5b7fb430ba3e23b7d93115644',
};

const groups = {
  ACCOUNT_ALERTS: 29545,
};

// using Twilio SendGrid's v3 Node.js Library
// https://github.com/sendgrid/sendgrid-nodejs
const sgMail = require('@sendgrid/mail')
sgMail.setApiKey(SENDGRID_API_KEY)

async function sendEmail(msg) {
  const { to } = msg;
  logger.info(`Sending email to ${to}...`);
  try {
    await sgMail.send(msg);
    logger.info('Email sent!');
  } catch (error) {
    logger.error(error);
  }
}

async function sendTemplateEmail(templateId, to, dynamicTemplateData, groupId) {
  await sendEmail({
    to,
    from: 'contact@archivium.net',
    templateId,
    dynamicTemplateData,
    asm: { groupId },
  });
}

module.exports = {
  templates,
  groups,
  sendEmail,
  sendTemplateEmail,
};
