import { Family } from "../api/models/item";

export type FamilyTreeLayout = {
  width: number,
  members: {
    [shortname: string]: {
      row: number,
      col: number,
      cStart?: number,
      cEnd?: number,
    },
  },
};

function _layoutDown(start: string, family: Family): FamilyTreeLayout {
  const tree: FamilyTreeLayout = {
    width: 0,
    members: { [start]: { row: 0, col: 0 } },
  };

  const childTrees: FamilyTreeLayout[] = [];
  for (const { child_shortname } of family[start].children) {
    const childTree = _layoutDown(child_shortname, family);
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
  console.log(spouses)

  let offset = Math.max(0, startGenWidth - tree.width) / 2;
  for (const childTree of childTrees) {
    for (const member in childTree.members) {
      childTree.members[member].col += offset;
      if (childTree.members[member].cStart !== undefined) childTree.members[member].cStart += offset;
      if (childTree.members[member].cEnd !== undefined) childTree.members[member].cEnd += offset;
      childTree.members[member].row += 1;
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
      row: 0,
      col: tree.members[start].col + i*2,
    };
  }

  if (childTrees.length > 0) {
    const [cStart, cEnd] = [
      Math.min(tree.members[start].col, ...family[start].children.map(({ child_shortname }) => tree.members[child_shortname].col)),
      Math.max(
        tree.members[start].col,
        ...family[start].children.map(({ child_shortname }) => tree.members[child_shortname].col),
        ...Object.keys(spouses).map(spouse => tree.members[spouse].col),
      ),
    ];
    tree.members[start].cStart = cStart;
    tree.members[start].cEnd = cEnd;
  }

  console.log(tree)
  return tree;
}

export function layoutFamilyTree(start: string, family: Family): FamilyTreeLayout {
  const tree: FamilyTreeLayout = { width: 0, members: {} };

  // First our own width downwards
  const me = _layoutDown(start, family);

  return me;
}
