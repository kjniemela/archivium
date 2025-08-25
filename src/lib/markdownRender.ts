import { JSDOM } from 'jsdom';
import { MarkdownData, NodeAttributes, parseMarkdown } from './markdown';

const { document } = (new JSDOM(`...`)).window;

function createElement(
  type: string, 
  options: { attrs?: Record<string, any>, classList?: string[], dataset?: Record<string, any>, children?: HTMLElement[], style?: Record<string, string> } = {
    attrs: {}, classList: [], dataset: {}, children: [], style: {},
  }
): HTMLElement {
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
      el.style[key as any] = style[key];
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
    if (child) el.appendChild(child);
  }
  return el;
}

interface MDElementParent {
  getElement: () => HTMLElement;
}

type MarkdownMeta = { isToc?: boolean, isLink?: boolean };

class MarkdownElement implements MDElementParent {
  type!: string;
  parent: MDElementParent;
  element: HTMLElement | null = null;
  attrs!: NodeAttributes & { [key: string]: any };
  dataset!: { [key: string]: any };
  meta!: MarkdownMeta;
  content!: string;
  children!: any[];
  classes: any;

  constructor(parent: MDElementParent, data: MarkdownData, meta: MarkdownMeta={}) {
    this.parent = parent;
    this.update(data, meta);

    this.element = null;
  }
  
  update([type, content, children, attrs]: MarkdownData, meta: MarkdownMeta={}) {
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

    if (this.type === 'text') this.type = 'span';
    if (this.attrs.id === 'toc') meta.isToc = true;
    if (this.type === 'a') meta.isLink = true;

    this.content = content;
    this.children = children.map(child => new MarkdownElement(this, child, { ...meta }));

    if (this.attrs.class) {
      this.classes = this.attrs.class.split(' ');
      delete this.attrs.class;
    } else {
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

  getElement(): HTMLElement {
    return this.element as HTMLElement;
  }

  render() {
    const prevEl = this.element;
    if (prevEl) this.parent.getElement().replaceChild(this.makeElement(), prevEl);
    else this.parent.getElement().appendChild(this.makeElement());
  }
}

export async function loadMarkdown(container: HTMLElement, universeShortname: string, body: string, ctx?: { [key: string]: any }, frmt?: any, render=true) {
  const data = await parseMarkdown(body).evaluate(universeShortname, ctx, frmt);
  container.classList.add('markdown');
  const nodes = new MarkdownElement({ getElement: () => container }, data);
  if (render) nodes.render();
  return nodes;
}

export async function renderMarkdown(universeShortname: string, body: string, ctx?: { [key: string]: any; }, frmt?: any) {
  const container = createElement('div');
  await loadMarkdown(container, universeShortname, body, ctx, frmt);
  return container.innerHTML;
}

export async function renderMdPreview(universeShortname: string, body: string, ctx?: { [key: string]: any; }, frmt?: any) {
  const container = createElement('div');
  const nodes = await loadMarkdown(container, universeShortname, body, ctx, frmt);
  return nodes.children.map(child => child.getElement().textContent).join(' ');
}
