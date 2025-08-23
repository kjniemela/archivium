import { parseMarkdown, type MarkdownData, type NodeAttributes } from "../../src/markdown";

// TODO this is duplicated from helpers.pug
export const capitalize = (str: string) => str[0].toUpperCase() + str.substr(1,str.length-1);
export const formatDate = (date: Date, intervalOnly=false, short=false) => {
  if (!date) return;
  const now = new Date();
  const secondsAgo = (now.getTime() - date.getTime()) / 1000;
  if (secondsAgo < 0) {
    //- Future Dates
    const secondsUntil = (date.getTime() - now.getTime()) / 1000;
    if (secondsUntil < 60) return `in ${Math.round(secondsUntil)} second${Math.round(secondsUntil) === 1 ? '' : 's'}`;
    const minutesUntil = secondsUntil / 60;
    if (minutesUntil < 60) return `in ${Math.round(minutesUntil)} minute${Math.round(minutesUntil) === 1 ? '' : 's'}`;
    const hoursUntil = minutesUntil / 60;
    if (hoursUntil < 24) return `in ${Math.round(hoursUntil)} hour${Math.round(hoursUntil) === 1 ? '' : 's'}`;
    const daysUntil = hoursUntil / 24;
    if (daysUntil < 30) return `in ${Math.round(daysUntil)} day${Math.round(daysUntil) === 1 ? '' : 's'}`;
    if (intervalOnly) {
      const weeksUntil = daysUntil / 7;
      if (Math.round(weeksUntil) < 8) return `in ${Math.round(weeksUntil)} week${Math.round(weeksUntil) === 1 ? '' : 's'}`;
      const monthDiff = now.getMonth() - date.getMonth();
      const yearDiff = now.getFullYear() - date.getFullYear();
      if (yearDiff === 0) {
        return `in ${monthDiff} months`;
      } else if (yearDiff === 1) {
        if (monthDiff < 0) return `in ${monthDiff + 12} months`;
        else return 'next year';
      } else {
        const yearsUntil = yearDiff - (monthDiff < 0 ? 1 : 0);
        if (yearsUntil === 1) return 'next year';
        else return `${yearsUntil} years ago`;
      }
    }
  } else {
    //- Past Dates
    if (secondsAgo < 60) return `${Math.round(secondsAgo)} second${Math.round(secondsAgo) === 1 ? '' : 's'} ago`;
    const minutesAgo = secondsAgo / 60;
    if (minutesAgo < 60) return `${Math.round(minutesAgo)} minute${Math.round(minutesAgo) === 1 ? '' : 's'} ago`;
    const hoursAgo = minutesAgo / 60;
    if (hoursAgo < 24) return `${Math.round(hoursAgo)} hour${Math.round(hoursAgo) === 1 ? '' : 's'} ago`;
    const daysAgo = hoursAgo / 24;
    if (daysAgo < 30) return `${Math.round(daysAgo)} day${Math.round(daysAgo) === 1 ? '' : 's'} ago`;
    if (intervalOnly) {
      const weeksAgo = daysAgo / 7;
      if (Math.round(weeksAgo) < 8) return `${Math.round(weeksAgo)} week${Math.round(weeksAgo) === 1 ? '' : 's'} ago`;
      const monthDiff = now.getMonth() - date.getMonth();
      const yearDiff = now.getFullYear() - date.getFullYear();
      if (yearDiff === 0) {
        return `${monthDiff} months ago`;
      } else if (yearDiff === 1) {
        if (monthDiff < 0) return `${monthDiff + 12} months ago`;
        else return 'last year';
      } else {
        const yearsAgo = yearDiff - (monthDiff < 0 ? 1 : 0);
        if (yearsAgo === 1) return 'last year';
        else return `${yearsAgo} years ago`;
      }
    }
  }

  if (short) return `${date.toDateString()} ${date.toLocaleTimeString()}`;
  else return `on ${date.toDateString()} at ${date.toLocaleTimeString()}`;
};

export function sprintf(format: string, ...args: string[]): string {
  let i = 0;
  return format.replace(/%s/g, () => args[i++]);
}

export function T(str: string, ...args: string[]): string {
// return sprintf(locale[lang][str] ?? str, ...args);
  return sprintf(str, ...args);
}

export async function postFormData(url: string, data: { [key: string]: any }) {
  const formData = new FormData();
  for (const key in data) {
    formData.append(key, data[key]);
  }
  return await fetch(url, {
    method: 'POST',
    body: formData,
  });
}

export function deepCompare(a: any, b: any): boolean {
  if (!(a instanceof Object && b instanceof Object)) {
    return a === b;
  }
  for (const key in a) {
    if (!(key in b)) return false;
    if (!deepCompare(a[key], b[key])) return false;
  }
  for (const key in b) {
    if (!(key in a)) return false;
  }
  return true;
}

export class BulkExistsFetcher {
  data: { [universe: string]: string[] } = {};
  resolvers: { [key: string]: (exists: boolean) => void } = {};
  promises: { [key: string]: Promise<boolean> } = {};

  exists(universe: string, item: string): Promise<boolean> {
    if (`${universe}/${item}` in this.promises) return this.promises[`${universe}/${item}`];
    if (!(universe in this.data)) this.data[universe] = [];
    const promise = new Promise<boolean>(async (resolve) => {
      this.data[universe].push(item);
      this.resolvers[`${universe}/${item}`] = resolve;
    });
    this.promises[`${universe}/${item}`] = promise;
    return promise;
  }

  async fetchAll() {
    const result = await (await fetch('/api/exists', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.data),
    })).json();
    for (const universe in result) {
      for (const item in result[universe]) {
        this.resolvers[`${universe}/${item}`](result[universe][item] as boolean);
      }
    }
  }
}

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
