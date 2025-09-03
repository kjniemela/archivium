import StarterKit from '@tiptap/starter-kit';
import Aside from './extensions/Aside';
import Image from './extensions/Image';
import Link, { ResolveResult } from './extensions/Link';
import ToC from './extensions/ToC';
import Heading from './extensions/Heading';

export interface TiptapContext {
  currentUniverse: string;
  universeLink: (universe: string) => string;
  itemExists: (universe: string, item: string) => boolean;
  headings: { title: string, level: number }[],
}

export type LinkData = {
  universe?: string,
  item?: string,
  hash?: string,
  query?: string,
};

export function extractLinkData(href: string): LinkData {
  const data: LinkData = {};

  if (href.startsWith('@')) {
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
  }

  return data;
}

export function shorthandResolver(href: string, ctx: TiptapContext | undefined): ResolveResult {
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

export const editorExtensions = (editMode: boolean, context?: TiptapContext) => ([
  StarterKit.configure({
    link: false,
    heading: false,
  }),
  Aside,
  Heading,
  Image,
  Link.configure({
    enableClickSelection: editMode,
    openOnClick: !editMode,
    shorthandResolver,
    context,
  }),
  ToC.configure({ context }),
]);
