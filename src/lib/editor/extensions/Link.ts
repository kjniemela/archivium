import TiptapLink, { LinkOptions } from '@tiptap/extension-link';
import { mergeAttributes } from '@tiptap/core';
import { LinkingContext } from '..';

export interface ResolveResult {
  href: string;
  exists?: boolean;
}

export type ShorthandResolver = (shorthand: string, context: LinkingContext | undefined) => ResolveResult;

interface ExtendedLinkOptions extends LinkOptions {
  shorthandResolver: ShorthandResolver;
  context?: LinkingContext;
}

const Link = TiptapLink.configure({
  autolink: true,
  HTMLAttributes: {
    rel: false,
    target: false,
    class: 'link link-animated',
  },
}).extend<ExtendedLinkOptions>({
  addOptions() {
    const parent = (this.parent?.() as LinkOptions) ?? {};
    return {
      ...parent,
      shorthandResolver: (s: string) => ({ href: s, pending: true }),
    };
  },

  renderHTML({ HTMLAttributes }) {
    const resolved: ResolveResult = this.options.shorthandResolver(HTMLAttributes.href, this.options.context);

    const href = resolved.href;
    const exists = resolved.exists as boolean ?? true;

    return [
      'a',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        href,
        class: exists ? '' : 'link-broken',
      }),
      0,
    ];
  },
});

export default Link;
