import { HocuspocusProvider } from '@hocuspocus/provider';
import { useEffect, useState } from 'react';
import { fetchAsync } from '../helpers';

import md5 from 'md5';
import * as Y from 'yjs';

export type DocUser = {
  clientId: number,
  name: string,
  color: string | null,
  selectedElement: string | null,
  tab: string | null,
  pfp: string,
};

export type DocSelections = {
  selectedElement: { [el: string]: DocUser },
  tab: { [tab: string]: DocUser[] },
}

type AwarenessState = { clientId: number, user: DocUser };

const colors = [
  ...[
    '#3CB371',
    '#DC143C',
    '#C71585',
    '#FF7F50',
    '#4682B4',
    '#808000',
  ].sort(() => Math.random() - 0.5),
  ...[
    '#008000',
    '#F08080',
    '#FF6347',
    '#F0E68C',
    '#6A5ACD',
    '#9ACD32'
  ].sort(() => Math.random() - 0.5),
  ...[
    '#66CDAA',
    '#FFB6C1',
  ].sort(() => Math.random() - 0.5),
];

export function useProvider(url: string, name: string, ydoc: Y.Doc): [
  HocuspocusProvider | null,
  string | null,
  DocUser[],
  DocSelections,
  (data: Partial<DocUser>) => void,
] {
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<{ [id: number]: DocUser }>({});
  const [me, setMe] = useState<DocUser | null>(null);

  useEffect(() => {
    if (!provider) return;
    provider.setAwarenessField('user', me);
  }, [me]);

  useEffect(() => {
    fetchAsync('/api/me').then(async (user) => {
      const token = await fetchAsync('/api/session-token');

      const provider = new HocuspocusProvider({ url, name, document: ydoc, token });

      const me: DocUser = {
        clientId: provider.awareness!.clientID,
        name: user.username,
        color: null,
        selectedElement: null,
        tab: null,
        pfp: user.hasPfp ? `/api/users/${user.username}/pfp` : `https://www.gravatar.com/avatar/${md5(user.email ?? '')}.jpg`,
      };

      let highlights: HTMLElement[] = [];

      const handleAwarenessChange = (states: AwarenessState[]): { [color: string]: true } => {
        for (const el of highlights) {
          el.style.border = '';
        }
        highlights = [];

        const newUsers: { [id: number]: DocUser } = {};
        const usedColors: { [color: string]: true } = {};
        for (const { clientId, user } of states) {
          if (clientId === me.clientId || !user) continue;
          if (user.color) usedColors[user.color] = true;
          newUsers[clientId] = user;
        }
        setUsers(newUsers);

        return usedColors;
      };

      provider.on('synced', () => {
        const awareness = provider.awareness!.states;
        const mappedStates: AwarenessState[] = Array
          .from(awareness.keys())
          .map(k => ({ clientId: k, ...awareness.get(k) } as AwarenessState));

        const usedColors = handleAwarenessChange(mappedStates);
        if (me.color === null) {
          let i = 0;
          while (colors[i] in usedColors && i < colors.length) {
            i++;
          }
          me.color = colors[i];
        }
        setMe(me);
      });

      provider.on('awarenessChange', ({ states }: { states: AwarenessState[] }) => {
        handleAwarenessChange(states);
      });

      provider.on('authenticationFailed', () => {
        setError('Access denied');
      });

      setProvider(provider);
    });
  }, []);

  const userList = me ? [
    ...Object.keys(users).map(k => users[Number(k)]),
    me,
  ] : [];

  const selections: DocSelections = { selectedElement: {}, tab: {} };
  for (const id in users) {
    const user = users[id];
    if (user.selectedElement && user.color) {
      selections.selectedElement[user.selectedElement] = user;
    }
    if (user.tab && user.color) {
      if (!selections.tab[user.tab]) selections.tab[user.tab] = [];
      selections.tab[user.tab].push(user);
    }
  }

  const setAwareness = (data: Partial<DocUser>): void => {
    if (!me) return;
    setMe({ ...me, ...data });
  };

  return [provider, error, userList, selections, setAwareness];
}
