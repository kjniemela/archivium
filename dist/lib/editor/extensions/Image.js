"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const extension_image_1 = __importDefault(require("@tiptap/extension-image"));
const core_1 = require("@tiptap/core");
const Image = extension_image_1.default.extend({
    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            { class: 'img-container' },
            ['img', (0, core_1.mergeAttributes)(this.options.HTMLAttributes, HTMLAttributes)],
        ];
    },
    parseHTML() {
        return [
            {
                tag: 'div.img-container img',
                getAttrs: (element) => {
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
exports.default = Image;
