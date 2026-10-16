import { useSyncExternalStore } from 'react';
import type { ContactListEntry } from '../../../src/api/models/contact';

const EMPTY: never[] = [];

export function useContacts(): ContactListEntry[] {
  return useSyncExternalStore(
    (cb) => { window.addEventListener('presence', cb); return () => window.removeEventListener('presence', cb); },
    () => window.presence?.contacts ?? EMPTY,
  );
}

