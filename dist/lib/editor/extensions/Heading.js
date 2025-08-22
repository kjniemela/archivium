"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.slugify = slugify;
const extension_heading_1 = __importDefault(require("@tiptap/extension-heading"));
const core_1 = require("@tiptap/core");
function slugify(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\- ]+/g, '') // remove non-word chars
        .replace(/\s+/g, '-'); // spaces → dashes
}
exports.default = extension_heading_1.default.extend({
    renderHTML({ node, HTMLAttributes }) {
        return [
            `h${node.attrs.level}`,
            (0, core_1.mergeAttributes)(HTMLAttributes, { id: slugify(node.textContent) }),
            0,
        ];
    },
});
