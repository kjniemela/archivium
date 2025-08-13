"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@tiptap/core");
const Aside = core_1.Node.create({
    name: 'aside',
    group: 'block',
    content: 'block+',
    defining: true,
    addOptions() {
        return {
            HTMLAttributes: {},
        };
    },
    parseHTML() {
        return [{ tag: 'aside' }];
    },
    renderHTML({ HTMLAttributes }) {
        return ['aside', (0, core_1.mergeAttributes)(this.options.HTMLAttributes, HTMLAttributes), 0];
    },
    addCommands() {
        return {
            wrapAside: () => ({ commands }) => commands.wrapIn(this.name),
            toggleAside: () => ({ commands }) => commands.toggleWrap(this.name),
        };
    },
    addInputRules() {
        return [
            (0, core_1.wrappingInputRule)({
                find: /^@aside\s$/,
                type: this.type,
            }),
        ];
    },
});
exports.default = Aside;
