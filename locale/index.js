const { perms } = require('../api/utils');
const api = require('../api');

const locale = {
  en: {
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
  },
  sv: {
    article: 'artikel',
    articles: 'artiklar',
    character: 'karaktär',
    characters: 'karaktärer',
    location: 'område',
    locations: 'områden',
    event: 'händelse',
    events: 'händelser',
    archive: 'arkiv',
    archives: 'arikv',
    document: 'dokument',
    documents: 'dokument',
    timeline: 'tidslinje',
    timelines: 'tidslinjer',
    item: 'föremål',
    items: 'föremål',
    organization: 'organisation',
    organizations: 'organisationer',
    'Missing Category': 'Missing Category',
    'Home': 'Hem',
    'Search': 'Sök',
    'Contacts': 'Kontakter',
    'Universes': 'Universum',
    'Items': 'Föremål',
    'Notes': 'Anteckningar',
    'News': 'Nyheter',
    'Help': 'Hjälp',
    'Profile': 'Min Profil',
    'Settings': 'Inställningar',
    'Notifications': 'Aviseringar',
    'Log Out': 'Logga Ut',
    'Login': 'Logga In',
    'Create Access': 'Skappa Konto',
    'Privacy Policy': 'Integritetspolicy',
    'Terms of Service': 'Användarvillkor',
    'Code of Conduct': 'Uppförandekod',
    'Developed by ': 'Utvecklad av ',
    'Open source on ': 'Öppen källkod på ',
    [`perms_${perms.NONE}`]: 'Ingen',
    [`perms_${perms.READ}`]: 'Läsåtkomst',
    [`perms_${perms.COMMENT}`]: 'Åtkomst till kommentarer',
    [`perms_${perms.WRITE}`]: 'Skrivåtkomst',
    [`perms_${perms.ADMIN}`]: 'Administratör',
    [`perms_${perms.OWNER}`]: 'Ägare',
    [`notif_${api.notification.types.CONTACTS}`]: 'Kontaktförfrågan',
    [`notif_${api.notification.types.UNIVERSE}`]: 'Universum Updateringar',
    [`notif_${api.notification.types.COMMENTS}`]: 'Kommentarer & Diskussioner',
    [`notif_${api.notification.types.FEATURES}`]: 'Archivium Updateringar',
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
