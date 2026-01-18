"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.layoutFamilyTree = layoutFamilyTree;
function _layoutDown(start, family) {
    const tree = {
        width: 0,
        members: { [start]: { row: 0, col: 0, cStart: 0, cEnd: 0 } },
    };
    const childTrees = [];
    for (const { child_shortname } of family[start].children) {
        const childTree = _layoutDown(child_shortname, family);
        tree.width += childTree.width;
        childTrees.push(childTree);
    }
    let offset = 0;
    for (const childTree of childTrees) {
        for (const member in childTree.members) {
            childTree.members[member].col += offset;
            childTree.members[member].cStart += offset;
            childTree.members[member].cEnd += offset;
            childTree.members[member].row += 1;
        }
        offset += childTree.width;
        tree.members = { ...tree.members, ...childTree.members };
    }
    if (tree.width === 0)
        tree.width = 2;
    tree.members[start].col += tree.width / 2;
    tree.members[start].cStart = Math.min(tree.members[start].col, ...family[start].children.map(({ child_shortname }) => tree.members[child_shortname].col));
    tree.members[start].cEnd = Math.max(tree.members[start].col, ...family[start].children.map(({ child_shortname }) => tree.members[child_shortname].col));
    console.log(tree);
    return tree;
}
function layoutFamilyTree(start, family) {
    const tree = { width: 0, members: {} };
    // First our own width downwards
    const me = _layoutDown(start, family);
    return me;
}
