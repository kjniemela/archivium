interface OffsetTextNode {
  type: string;
  start?: number;
  end?: number;
  marks?: any[];
  content?: OffsetTextNode[];
  attrs?: { [key: string]: any };
}

interface CombinedNode {
  type: string;
  text?: string;
  marks?: any[];
  content?: OffsetTextNode[];
  attrs?: { [key: string]: any };
}

export interface IndexedDocument {
  text: string;
  structure: OffsetTextNode[];
}

function cleanupMark(mark) {
  const newMark = { ...mark };
  if (newMark.type === 'link') {
    newMark.attrs = {
      href: newMark.attrs.href,
      class: newMark.attrs.class,
    };
  }
  return newMark;
}

export function jsonToIndexed(doc: any): IndexedDocument {
  let textBuffer = '';
  let pos = 0;

  function walk(node: any): OffsetTextNode {
    if (node.type === 'text') {
      const start = pos;
      textBuffer += node.text || '';
      pos += (node.text || '').length;
      return {
        type: 'text',
        start,
        end: pos,
        marks: (node.marks || []).map(cleanupMark),
        attrs: node.attrs ?? {},
      };
    }

    const content = (node.content || []).map(walk);

    // preserve block breaks between top-level nodes
    if ((node.type === 'paragraph' || node.type === 'heading') && content.length > 0) {
      textBuffer += '\n';
      pos += 1;
    }

    return {
      type: node.type,
      marks: (node.marks || []).map(cleanupMark),
      attrs: node.attrs ?? {},
      content,
    };
  }

  const structure = (doc.content || []).map(walk);
  return { text: textBuffer, structure };
}

export function indexedToJson(indexed: IndexedDocument, linkHandler?: (href: string) => void): any {
  const { text, structure } = indexed;

  function walk(node: OffsetTextNode): any {
    if (node.type === 'text') {
      const combinedNode: CombinedNode = {
        type: 'text',
        text: text.slice(node.start, node.end),
      };
      if (node.marks && node.marks.length > 0) combinedNode.marks = node.marks;
      if (node.attrs && Object.keys(node.attrs).length > 0) combinedNode.attrs = node.attrs;
      for (const mark of combinedNode.marks ?? []) {
        if (mark.attrs && mark.attrs.href && linkHandler) {
          linkHandler(mark.attrs.href);
        }
      }
      return combinedNode;
    }

    const combinedNode: CombinedNode = { type: node.type };
    if (node.marks && node.marks.length > 0) combinedNode.marks = node.marks;
    if (node.attrs && Object.keys(node.attrs).length > 0) combinedNode.attrs = node.attrs;
    if (node.content && node.content.length > 0) {
      combinedNode.content = node.content.map(walk);
    }

    return combinedNode;
  }

  return { type: 'doc', content: structure.map(walk) };
}
