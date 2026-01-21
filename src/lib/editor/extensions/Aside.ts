import { Node, mergeAttributes, wrappingInputRule } from '@tiptap/core';

export interface AsideOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    aside: {
      wrapAside: () => ReturnType
      toggleAside: () => ReturnType
    }
  }
}

const Aside = Node.create<AsideOptions>({
  name: 'aside',
  group: 'block',
  content: 'block+',
  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  parseHTML() {
    return [{ tag: 'aside' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['aside', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      wrapAside: () =>
        ({ commands }) =>
          commands.wrapIn(this.name),
      toggleAside: () =>
        ({ commands }) =>
          commands.toggleWrap(this.name),
    };
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: /^@aside\s$/,
        type: this.type,
      }),
    ];
  },
});

export default Aside;
