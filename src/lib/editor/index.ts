import StarterKit from '@tiptap/starter-kit';
import Aside from './extensions/Aside';
import Image from './extensions/Image';
import Link, { ResolveResult } from './extensions/Link';

export interface LinkingContext {
  currentUniverse: string;
  universeLink: (universe: string) => string;
  itemExists: (universe: string, item: string) => boolean;
}

export type LinkData = {
  universe?: string,
  item?: string,
  hash?: string,
  query?: string,
};

export function extractLinkData(href: string): LinkData {
  const data: LinkData = {};
  let [first, second] = href.substring(1).split('/');
  if (first) {
    data.universe = first;
    if (!second) {
      second = first;
      delete data.universe;
    }

    const [itemQuery, hash] = second.split('#');
    const [item, query] = itemQuery.split('?');

    data.item = item;
    data.hash = hash;
    data.query = query;
  }

  return data;
}

export function shorthandResolver(href: string, ctx: LinkingContext | undefined): ResolveResult {
  if (!href) return { href: '' };

  if (ctx) {
    if (href.startsWith('@')) {
      const { universe, item, hash, query } = extractLinkData(href);
      if (item) {;
        const universeLink = ctx.universeLink(universe ?? ctx.currentUniverse);
        return {
          href: `${universeLink}/items/${item}${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`,
          exists: ctx.itemExists(universe ?? ctx.currentUniverse, item),
        };
      }
    }
  }

  return { href };
}

export const editorExtensions = (editMode: boolean, context: LinkingContext) => ([
  StarterKit.configure({
    link: false,
  }),
  Aside,
  Image,
  Link.configure({
    enableClickSelection: editMode,
    openOnClick: !editMode,
    shorthandResolver,
    context,
  }),
]);
