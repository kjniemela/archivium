"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.editorExtensions = void 0;
exports.extractLinkData = extractLinkData;
exports.shorthandResolver = shorthandResolver;
const starter_kit_1 = __importDefault(require("@tiptap/starter-kit"));
const Aside_1 = __importDefault(require("./extensions/Aside"));
const Image_1 = __importDefault(require("./extensions/Image"));
const Link_1 = __importDefault(require("./extensions/Link"));
function extractLinkData(href) {
    const data = {};
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
function shorthandResolver(href, ctx) {
    if (!href)
        return { href: '' };
    if (ctx) {
        if (href.startsWith('@')) {
            const { universe, item, hash, query } = extractLinkData(href);
            if (item) {
                ;
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
const editorExtensions = (editMode, context) => ([
    starter_kit_1.default.configure({
        link: false,
    }),
    Aside_1.default,
    Image_1.default,
    Link_1.default.configure({
        enableClickSelection: editMode,
        openOnClick: !editMode,
        shorthandResolver,
        context,
    }),
]);
exports.editorExtensions = editorExtensions;
