"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.layoutFamilyTree = layoutFamilyTree;
function _layoutDown(start, family, height = 0) {
    const tree = {
        width: 0,
        members: { [start]: { row: height, col: 0 } },
    };
    const childTrees = [];
    for (const { child_shortname } of family[start].children) {
        const childTree = _layoutDown(child_shortname, family, height + 1);
        tree.width += childTree.width;
        childTrees.push(childTree);
    }
    const spouses = {};
    for (const { child_shortname } of family[start].children) {
        for (const { parent_shortname } of family[child_shortname].parents) {
            if (!(parent_shortname in spouses) && parent_shortname !== start) {
                spouses[parent_shortname] = true;
            }
        }
    }
    const startGenWidth = 2 + Object.keys(spouses).length * 2;
    let offset = Math.max(0, startGenWidth - tree.width) / 2;
    for (const childTree of childTrees) {
        for (const member in childTree.members) {
            childTree.members[member].col += offset;
            if (childTree.members[member].cStart !== undefined)
                childTree.members[member].cStart += offset;
            if (childTree.members[member].cEnd !== undefined)
                childTree.members[member].cEnd += offset;
        }
        offset += childTree.width;
        tree.members = { ...tree.members, ...childTree.members };
    }
    tree.width = Math.max(tree.width, startGenWidth);
    tree.members[start].col += (tree.width / 2 - startGenWidth / 2) + 1;
    let i = 0;
    for (const spouse in spouses) {
        i++;
        tree.members[spouse] = {
            row: height,
            col: tree.members[start].col + i * 2,
        };
    }
    if (childTrees.length > 0) {
        const [cStart, cEnd] = [
            Math.min(tree.members[start].col, ...family[start].children.map(({ child_shortname }) => tree.members[child_shortname].col)),
            Math.max(tree.members[start].col, ...family[start].children.map(({ child_shortname }) => tree.members[child_shortname].col), ...Object.keys(spouses).map(spouse => tree.members[spouse].col)),
        ];
        tree.members[start].cStart = cStart;
        tree.members[start].cEnd = cEnd;
    }
    return tree;
}
function _layoutUp(start, family, height = 0) {
    const tree = {
        width: 0,
        members: { [start]: { row: height, col: 0 } },
    };
    let firstParent = null;
    const parentTrees = [];
    for (const { parent_shortname } of family[start].parents) {
        const parentTree = _layoutUp(parent_shortname, family, height - 1);
        if (!firstParent)
            firstParent = parent_shortname;
        tree.width += parentTree.width;
        parentTrees.push(parentTree);
    }
    let offset = 0;
    let leastRow = 0;
    for (const parentTree of parentTrees) {
        for (const member in parentTree.members) {
            parentTree.members[member].col += offset;
            if (parentTree.members[member].cStart !== undefined)
                parentTree.members[member].cStart += offset;
            if (parentTree.members[member].cEnd !== undefined)
                parentTree.members[member].cEnd += offset;
            leastRow = Math.min(leastRow, parentTree.members[member].row);
        }
        offset += parentTree.width;
        tree.members = { ...tree.members, ...parentTree.members };
    }
    tree.width = Math.max(2, tree.width);
    tree.members[start].col += tree.width / 2;
    if (firstParent) {
        tree.members[firstParent].cStart = tree.members[firstParent].col;
        tree.members[firstParent].cEnd = Math.max(...family[start].parents.map(({ parent_shortname }) => tree.members[parent_shortname].col));
    }
    return tree;
}
function _joinTrees(treeA, treeB) {
    for (const member in treeB.members) {
        treeB.members[member].col += treeA.width;
        if (treeB.members[member].cStart !== undefined)
            treeB.members[member].cStart += treeA.width;
        if (treeB.members[member].cEnd !== undefined)
            treeB.members[member].cEnd += treeA.width;
    }
    return {
        width: treeA.width + treeB.width,
        members: {
            ...treeA.members,
            ...treeB.members,
        }
    };
}
function _addParents(tree, parents, children, parentTrees) {
    if (parents.length === 0 || children.length === 0)
        return;
    const cols = [];
    for (const child of children) {
        cols.push(tree.members[child].col);
    }
    const childRow = tree.members[children[0]].row;
    let minCol = Math.min(...cols);
    let maxCol = Math.max(...cols);
    const avgCol = Math.ceil((minCol + maxCol) / 2);
    let offset = avgCol - (parents.reduce((w, p) => w + parentTrees[p].width, 0) / 2);
    if (offset < 0) {
        for (const member in tree.members) {
            tree.members[member].col -= offset;
            if (tree.members[member].cStart !== undefined)
                tree.members[member].cStart -= offset;
            if (tree.members[member].cEnd !== undefined)
                tree.members[member].cEnd -= offset;
        }
        minCol -= offset;
        maxCol -= offset;
        offset -= offset;
    }
    const firstParent = parents[0];
    for (const parent of parents) {
        for (const member in parentTrees[parent].members) {
            parentTrees[parent].members[member].col += offset;
            if (parentTrees[parent].members[member].cStart !== undefined)
                parentTrees[parent].members[member].cStart += offset;
            if (parentTrees[parent].members[member].cEnd !== undefined)
                parentTrees[parent].members[member].cEnd += offset;
            parentTrees[parent].members[member].row += childRow - 1;
        }
        Object.assign(tree.members, parentTrees[parent].members);
        tree.width = Math.max(tree.width, offset + parentTrees[parent].width);
        offset += parentTrees[parent].width;
    }
    const [cStart, cEnd] = [
        Math.min(tree.members[firstParent].col, minCol),
        Math.max(maxCol, ...parents.map(parent => tree.members[parent].col)),
    ];
    tree.members[firstParent].cStart = cStart;
    tree.members[firstParent].cEnd = cEnd;
}
function layoutFamilyTree(start, family) {
    // Fetch descendants
    let tree = _layoutDown(start, family);
    // Fetch two parents and two sets of two grandparents
    // If more than two, select the two with the longest lineage
    const allParents = family[start].parents.map(({ parent_shortname }) => {
        const grandparents = family[parent_shortname].parents.map(({ parent_shortname }) => {
            const grandparentTree = _layoutUp(parent_shortname, family);
            const leastRow = Math.min(...Object.values(grandparentTree.members).map(({ row }) => row));
            return [[parent_shortname, grandparentTree], -leastRow];
        }).sort((a, b) => a[1] - b[1]).slice(0, 2);
        return [[parent_shortname, grandparents.map(gp => gp[0])], Math.max(...grandparents.map(gp => gp[1]))];
    }).sort((a, b) => a[1] - b[1]).map(parent => parent[0]);
    const parents = allParents.slice(0, 2);
    // Fetch sibling descendants
    const siblingTrees = {};
    const parentShorts = allParents.map(parent => parent[0]);
    if (parentShorts.length > 0) {
        const parentStubs = {};
        const childShorts = [];
        for (const parent of parentShorts) {
            for (const { child_shortname } of family[parent].children) {
                if (child_shortname in siblingTrees || child_shortname === start)
                    continue;
                childShorts.push(child_shortname);
                siblingTrees[child_shortname] = true;
                tree = _joinTrees(tree, _layoutDown(child_shortname, family));
            }
            parentStubs[parent] = { width: 2, members: { [parent]: { row: 0, col: 1 } } };
        }
        _addParents(tree, parentShorts, [start, ...childShorts], parentStubs);
    }
    const uaTrees = {};
    // Fetch uncle/aunt descendants from the left side of the tree
    if (parents[0]) {
        const lhChildren = [];
        for (const { parent_shortname } of family[parents[0][0]].parents) {
            for (const { child_shortname } of family[parent_shortname].children) {
                if (child_shortname in uaTrees || child_shortname === parents[0][0])
                    continue;
                lhChildren.push(child_shortname);
                uaTrees[child_shortname] = true;
                tree = _joinTrees(_layoutDown(child_shortname, family, -1), tree);
            }
        }
        _addParents(tree, parents[0][1].map(t => t[0]), [parents[0][0], ...lhChildren], parents[0][1].reduce((acc, [p, t]) => ({ ...acc, [p]: t }), {}));
    }
    // And the right side
    if (parents[1]) {
        const rhChildren = [];
        for (const { parent_shortname } of family[parents[1][0]].parents) {
            for (const { child_shortname } of family[parent_shortname].children) {
                if (child_shortname in uaTrees || child_shortname === parents[1][0])
                    continue;
                rhChildren.push(child_shortname);
                uaTrees[child_shortname] = true;
                tree = _joinTrees(tree, _layoutDown(child_shortname, family, -1));
            }
        }
        _addParents(tree, parents[1][1].map(t => t[0]), [parents[1][0], ...rhChildren], parents[1][1].reduce((acc, [p, t]) => ({ ...acc, [p]: t }), {}));
    }
    const leastRow = Math.min(...Object.values(tree.members).map(({ row }) => row));
    for (const member in tree.members) {
        tree.members[member].row += -leastRow;
    }
    return tree;
}
