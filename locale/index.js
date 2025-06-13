const { perms } = require('../api/utils');
const api = require('../api');

const locale = {
  en: {
    article: 'article',
    articles: 'articles',
    character: 'character',
    characters: 'characters',
    location: 'location',
    locations: 'locations',
    event: 'event',
    events: 'events',
    archive: 'archive',
    archives: 'archives',
    document: 'document',
    documents: 'documents',
    timeline: 'timeline',
    timelines: 'timelines',
    item: 'item',
    items: 'items',
    organization: 'organization',
    organizations: 'organizations',
    'Missing Category': 'Missing Category',
    [`perms_${perms.NONE}`]: 'None',
    [`perms_${perms.READ}`]: 'Read',
    [`perms_${perms.COMMENT}`]: 'Comment',
    [`perms_${perms.WRITE}`]: 'Write',
    [`perms_${perms.ADMIN}`]: 'Admin',
    [`perms_${perms.OWNER}`]: 'Owner',
    [`notif_${api.notification.types.CONTACTS}`]: 'Contact Requests',
    [`notif_${api.notification.types.UNIVERSE}`]: 'Universe Updates',
    [`notif_${api.notification.types.COMMENTS}`]: 'Comments & Discussion',
    [`notif_${api.notification.types.FEATURES}`]: 'Archivium Updates',
  }
};

const lang = 'en';

function sprintf(format, ...args) {
  let i = 0;
  return format.replace(/%s/g, () => args[i++]);
}

function T(str, ...args) {
  if (!str) return '';
  return sprintf(locale[lang][str] ?? str, ...args);
}

module.exports = { locale, lang, sprintf, T };
