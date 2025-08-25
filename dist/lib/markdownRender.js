"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadMarkdown = loadMarkdown;
exports.renderMarkdown = renderMarkdown;
exports.renderMdPreview = renderMdPreview;
const jsdom_1 = require("jsdom");
const markdown_1 = require("./markdown");
const { document } = (new jsdom_1.JSDOM(`...`)).window;
function createElement(type, options = {
    attrs: {}, classList: [], dataset: {}, children: [], style: {},
}) {
    const { attrs, classList, dataset, children, style } = options;
    const el = document.createElement(type);
    for (const attr in attrs) {
        if (attr === 'innerText' || attr === 'textContent') {
            el.textContent = attrs[attr];
            continue;
        }
        el.setAttribute(attr, attrs[attr]);
    }
    if (style) {
        for (const key in style) {
            el.style[key] = style[key];
        }
    }
    if (dataset) {
        for (const key in dataset ?? {}) {
            el.dataset[key] = dataset[key];
        }
    }
    for (const cl of classList ?? []) {
        el.classList.add(cl);
    }
    for (const child of children ?? []) {
        if (child)
            el.appendChild(child);
    }
    return el;
}
class MarkdownElement {
    type;
    parent;
    element = null;
    attrs;
    dataset;
    meta;
    content;
    children;
    classes;
    constructor(parent, data, meta = {}) {
        this.parent = parent;
        this.update(data, meta);
        this.element = null;
    }
    update([type, content, children, attrs], meta = {}) {
        this.type = type;
        this.attrs = attrs ?? {};
        this.dataset = {};
        for (const key in this.attrs) {
            if (key.startsWith('data-')) {
                this.dataset[key.replace('data-', '')] = this.attrs[key];
                delete this.attrs[key];
            }
        }
        this.meta = { ...meta };
        if (this.type === 'text')
            this.type = 'span';
        if (this.attrs.id === 'toc')
            meta.isToc = true;
        if (this.type === 'a')
            meta.isLink = true;
        this.content = content;
        this.children = children.map(child => new MarkdownElement(this, child, { ...meta }));
        if (this.attrs.class) {
            this.classes = this.attrs.class.split(' ');
            delete this.attrs.class;
        }
        else {
            this.classes = [];
        }
    }
    makeElement() {
        const children = this.children.map(child => child.makeElement());
        this.element = createElement(this.type, {
            attrs: { ...this.attrs, innerText: this.content },
            dataset: this.dataset,
            children,
            classList: this.classes,
        });
        return this.element;
    }
    getElement() {
        return this.element;
    }
    render() {
        const prevEl = this.element;
        if (prevEl)
            this.parent.getElement().replaceChild(this.makeElement(), prevEl);
        else
            this.parent.getElement().appendChild(this.makeElement());
    }
}
async function loadMarkdown(container, universeShortname, body, ctx, frmt, render = true) {
    const data = await (0, markdown_1.parseMarkdown)(body).evaluate(universeShortname, ctx, frmt);
    container.classList.add('markdown');
    const nodes = new MarkdownElement({ getElement: () => container }, data);
    if (render)
        nodes.render();
    return nodes;
}
async function renderMarkdown(universeShortname, body, ctx, frmt) {
    const container = createElement('div');
    await loadMarkdown(container, universeShortname, body, ctx, frmt);
    return container.innerHTML;
}
async function renderMdPreview(universeShortname, body, ctx, frmt) {
    const container = createElement('div');
    const nodes = await loadMarkdown(container, universeShortname, body, ctx, frmt);
    return nodes.children.map(child => child.getElement().textContent).join(' ');
}
