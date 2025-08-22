import Heading from '@tiptap/extension-heading';
import { mergeAttributes } from '@tiptap/core';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\- ]+/g, '') // remove non-word chars
    .replace(/\s+/g, '-')      // spaces → dashes
}

export default Heading.extend({
  renderHTML({ node, HTMLAttributes }) {
    return [
      `h${node.attrs.level}`,
      mergeAttributes(HTMLAttributes, { id: slugify(node.textContent) }),
      0,
    ];
  },
});
