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
    'Create Account': 'Skappa Konto',
    'Privacy Policy': 'Integritetspolicy',
    'Terms of Service': 'Användarvillkor',
    'Code of Conduct': 'Uppförandekod',
    'Developed by ': 'Utvecklad av ',
    'Open source on ': 'Öppen källkod på ',
    'Welcome to Archivium!': 'Välkommen till Archivium!',
    'Archivium is a worldbuilding tool, allowing you to organize everything about your world in one place.':
      'Archivium är ett värktyg som tillåter dig att organisera allt möjligt om din värld i ett och samma ställe.',
    'It\'s designed for creators who want to keep track of all the details that make their worlds unique — from characters and histories to maps and cultures.': '',
    'Whether you\'re developing a novel, designing a game, or just exploring new ideas, ': '',
    'Archivium offers a flexible space to collect, connect, and expand on your world\'s elements at your own pace.': '',
    'You can work privately or collaborate with others, bringing your imaginative landscapes and stories to life.': '',
    'Hello %s! Looks like there\'s nothing here yet — go ahead and ': 'Hej %s! Det finns inger här ännu — ',
    'create a new universe': 'skappa ett nytt universum',
    ' to get started!': ' för att börja!',
    'My Universes': 'Mina Universum',
    'Name': 'Namn',
    'Updated': 'Uppdaterat',
    'Universes I Follow': 'Universum jag följer',
    'Recent Updates by Others': 'Nylage Uppdateringar av Andra Användare',
    'Universe': 'Universum',
    'Last updated by': 'Senast uppdaterat av',
    '(New)': '(Ny)',
    'No updates here — try following some ': 'Inga uppdateringar här — försök att följa några ',
    'universes': 'universum',
    ' first!': ' först!',
    'May Need Review': 'Kan behöva granskning',
    'Dismiss': 'Avfärda',
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

const lang = 'sv';

function sprintf(format, ...args) {
  let i = 0;
  return format.replace(/%s/g, () => args[i++]);
}

function T(str, ...args) {
  if (!str) return '';
  return sprintf(locale[lang][str] ?? str, ...args);
}

module.exports = { locale, lang, sprintf, T };
