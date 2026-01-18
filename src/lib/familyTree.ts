import { Family } from "../api/models/item";

export type FamilyTreeLayout = {
  width: number,
  members: {
    [shortname: string]: {
      row: number,
      col: number,
      cStart: number,
      cEnd: number,
    },
  },
};

function _layoutDown(start: string, family: Family): FamilyTreeLayout {
  const tree: FamilyTreeLayout = {
    width: 0,
    members: { [start]: { row: 0, col: 0, cStart: 0, cEnd: 0 } },
  };

  const childTrees: FamilyTreeLayout[] = [];
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

  if (tree.width === 0) tree.width = 2;
  tree.members[start].col += tree.width / 2;
  tree.members[start].cStart = Math.min(tree.members[start].col, ...family[start].children.map(({ child_shortname }) => tree.members[child_shortname].col));
  tree.members[start].cEnd = Math.max(tree.members[start].col, ...family[start].children.map(({ child_shortname }) => tree.members[child_shortname].col));

  console.log(tree)
  return tree;
}

export function layoutFamilyTree(start: string, family: Family): FamilyTreeLayout {
  const tree: FamilyTreeLayout = { width: 0, members: {} };

  // First our own width downwards
  const me = _layoutDown(start, family);

  return me;
}
