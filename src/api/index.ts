import { ContactAPI } from './models/contact';
import { DiscussionAPI } from './models/discussion';
import { EmailAPI } from './models/email';
import { ItemAPI } from './models/item';
import { NewsletterAPI } from './models/newsletter';
import { NoteAPI } from './models/note';
import { NotificationAPI } from './models/notification';
import { SessionAPI } from './models/session';
import { StoryAPI } from './models/story';
import { UniverseAPI } from './models/universe';
import { UserAPI } from './models/user';

export class API {
  readonly contact: ContactAPI;
  readonly discussion: DiscussionAPI;
  readonly email: EmailAPI;
  readonly item: ItemAPI;
  readonly newsletter: NewsletterAPI;
  readonly note: NoteAPI;
  readonly notification: NotificationAPI;
  readonly session: SessionAPI;
  readonly story: StoryAPI;
  readonly universe: UniverseAPI;
  readonly user: UserAPI;

  constructor() {
    this.contact = new ContactAPI(this);
    this.discussion = new DiscussionAPI(this);
    this.email = new EmailAPI(this);
    this.item = new ItemAPI(this);
    this.newsletter = new NewsletterAPI(this);
    this.note = new NoteAPI(this);
    this.notification = new NotificationAPI(this);
    this.session = new SessionAPI(this);
    this.story = new StoryAPI(this);
    this.universe = new UniverseAPI(this);
    this.user = new UserAPI(this);
  }
}

const api = new API();

export default api;
