import contact from './models/contact';
import discussion from './models/discussion';
import { EmailAPI } from './models/email';
import item from './models/item';
import newsletter from './models/newsletter';
import note from './models/note';
import { NotificationAPI } from './models/notification';
import session from './models/session';
import story from './models/story';
import universe from './models/universe';
import { UserAPI } from './models/user';

export class API {
  contact: typeof contact;
  discussion: typeof discussion;
  readonly email: EmailAPI;
  item: typeof item;
  newsletter: typeof newsletter;
  note: typeof note;
  readonly notification: NotificationAPI;
  session: any;
  story: typeof story;
  universe: typeof universe;
  readonly user: UserAPI;

  constructor() {
    this.contact = contact;
    this.discussion = discussion;
    this.email = new EmailAPI(this);
    this.item = item;
    this.newsletter = newsletter;
    this.note = note;
    this.notification = new NotificationAPI(this);
    this.session = session;
    this.story = story;
    this.universe = universe;
    this.user = new UserAPI(this);
  }
}

const api = new API();

contact.setApi(api);
discussion.setApi(api);
item.setApi(api);
newsletter.setApi(api);
note.setApi(api);
session.setApi(api);
story.setApi(api);
universe.setApi(api);

export default api;
