import type { ContactListEntry } from '../../src/api/models/contact';

declare global {
  interface ContactsPresence {
    onlineUsers?: string[],
    contacts?: ContactListEntry[],
  }

  interface Window {
    presence?: ContactsPresence;
  }
}
