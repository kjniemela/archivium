import TiptapImage from '@tiptap/extension-image';
import { mergeAttributes } from '@tiptap/core';

const Image = TiptapImage.extend({
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      { class: 'img-container' },
      ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)],
    ];
  },
  parseHTML() {
    return [
      {
        tag: 'div.img-container img',
        getAttrs: (element) => {
          if (!(element instanceof HTMLImageElement)) return {};
          return {
            src: element.getAttribute('src'),
            alt: element.getAttribute('alt'),
            title: element.getAttribute('title'),
          };
        },
      },
    ];
  },
});

export default Image;
