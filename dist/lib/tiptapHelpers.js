"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonToIndexed = jsonToIndexed;
exports.updateLinks = updateLinks;
exports.indexedToJson = indexedToJson;
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
function jsonToIndexed(doc) {
    let textBuffer = '';
    let pos = 0;
    function walk(node) {
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
function _getTextContent(node) {
    return `${node.text ?? ''}${(node.content ?? []).map(_getTextContent).join('')}`;
}
/**
 * Mutates the provided IndexedDocument.
 */
function updateLinks(indexed, getNewLink) {
    const { structure } = indexed;
    function walk(node) {
        if (node.type === 'text') {
            for (const mark of node.marks ?? []) {
                if (mark.attrs && mark.attrs.href && mark.attrs.href.startsWith('@')) {
                    mark.attrs.href = getNewLink(mark.attrs.href);
                }
            }
        }
        if (node.content && node.content.length > 0) {
            node.content.forEach(walk);
        }
    }
    structure.forEach(walk);
}
function indexedToJson(indexed, linkHandler, headingHandler) {
    const { text, structure } = indexed;
    function walk(node) {
        if (node.type === 'text') {
            const combinedNode = {
                type: 'text',
                text: text.slice(node.start, node.end),
            };
            if (node.marks && node.marks.length > 0)
                combinedNode.marks = node.marks;
            if (node.attrs && Object.keys(node.attrs).length > 0)
                combinedNode.attrs = node.attrs;
            for (const mark of combinedNode.marks ?? []) {
                if (mark.attrs && mark.attrs.href && linkHandler) {
                    linkHandler(mark.attrs.href);
                }
            }
            return combinedNode;
        }
        const combinedNode = { type: node.type };
        if (node.marks && node.marks.length > 0)
            combinedNode.marks = node.marks;
        if (node.attrs && Object.keys(node.attrs).length > 0)
            combinedNode.attrs = node.attrs;
        if (node.content && node.content.length > 0) {
            combinedNode.content = node.content.map(walk);
        }
        if (node.type === 'heading' && headingHandler) {
            const text = _getTextContent(combinedNode);
            if (text)
                headingHandler(text, combinedNode.attrs?.level ?? 1);
        }
        return combinedNode;
    }
    return { type: 'doc', content: structure.map(walk) };
}
