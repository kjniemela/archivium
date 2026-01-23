import { HocuspocusProvider } from '@hocuspocus/provider';
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { fetchAsync } from '../helpers';

import * as Y from 'yjs';
import md5 from 'md5';

export type DocUser = {
  clientId: number,
  name: string,
  color: string | null,
  selectedElement: string | null,
  pfp: string,
};

type AwarenessState = { clientId: number, user: DocUser };

const colors = [
  ...[
    'mediumseagreen',
    'crimson',
    'mediumvioletred',
    'coral',
    'steelblue',
    'olive',
  ].sort(() => Math.random() - 0.5),
  ...[
    'green',
    'lightcoral',
    'tomato',
    'khaki',
    'slateblue',
    'yellowgreen'
  ].sort(() => Math.random() - 0.5),
  ...[
    'mediumaquamarine',
    'lightpink',
  ].sort(() => Math.random() - 0.5),
];

export function useProvider(url: string, name: string, ydoc: Y.Doc): [HocuspocusProvider | null, DocUser[], { [el: string]: DocUser }, (data: Partial<DocUser>) => void] {
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [users, setUsers] = useState<{ [id: number]: DocUser }>({});
  const [me, setMe] = useState<DocUser | null>(null);

  useEffect(() => {
    if (!provider) return;
    provider.setAwarenessField('user', me);
  }, [me]);

  useEffect(() => {
    fetchAsync('/api/me').then((user) => {
      const provider = new HocuspocusProvider({ url, name, document: ydoc });

      const me: DocUser = {
        clientId: provider.awareness!.clientID,
        name: user.username,
        color: null,
        selectedElement: null,
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

      setProvider(provider);
    });
  }, []);

  const userList = me ? [
    me,
    ...Object.keys(users).map(k => users[Number(k)]),
  ] : [];

  const selections: { [el: string]: DocUser } = {};
  for (const id in users) {
    const user = users[id];
    if (user.selectedElement && user.color) {
      selections[user.selectedElement] = user;
    }
  }

  const setAwareness = (data: Partial<DocUser>): void => {
    if (!me) return;
    setMe({ ...me, ...data });
  };

  return [provider, userList, selections, setAwareness];
}
