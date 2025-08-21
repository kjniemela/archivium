"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const extension_link_1 = __importDefault(require("@tiptap/extension-link"));
const core_1 = require("@tiptap/core");
const Link = extension_link_1.default.configure({
    autolink: true,
    HTMLAttributes: {
        rel: false,
        target: false,
        class: 'link link-animated',
    },
}).extend({
    addOptions() {
        const parent = this.parent?.() ?? {};
        return {
            ...parent,
            shorthandResolver: (s) => ({ href: s, pending: true }),
        };
    },
    renderHTML({ HTMLAttributes }) {
        const resolved = this.options.shorthandResolver(HTMLAttributes.href, this.options.context);
        const href = resolved.href;
        const exists = resolved.exists ?? true;
        return [
            'a',
            (0, core_1.mergeAttributes)(this.options.HTMLAttributes, HTMLAttributes, {
                href,
                class: exists ? '' : 'link-broken',
            }),
            0,
        ];
    },
});
exports.default = Link;
