import { useState } from 'react';
import type { Item } from '../../../src/api/models/item';
import { T } from '../helpers';
import SearchableSelect from './SearchableSelect';

type LineageEditorProps = {
  item: Item,
  onUpdate: (newItem: Item) => void,
  itemMap: Record<string, string>,
};

export default function LineageEditor({ item, onUpdate, itemMap }: LineageEditorProps) {
  const [newParent, setNewParent] = useState<string | null>(null);
  const [newParentSelfLabel, setNewParentSelfLabel] = useState<string>('');
  const [newParentOtherLabel, setNewParentOtherLabel] = useState<string>('');
  const [newChild, setNewChild] = useState<string | null>(null);
  const [newChildSelfLabel, setNewChildSelfLabel] = useState<string>('');
  const [newChildOtherLabel, setNewChildOtherLabel] = useState<string>('');

  const deleteParent = (index: number) => {
    const newState = { ...item };
    newState.parents.splice(index, 1);
    onUpdate(newState);
  };

  const deleteChild = (index: number) => {
    const newState = { ...item };
    newState.children.splice(index, 1);
    onUpdate(newState);
  };

  const addParent = () => {
    const newState = { ...item };
    if (!newParent) return;
    const existing = newState.parents.find((parent) => parent.parent_shortname === newParent);
    if (existing) {
      existing.child_label = newParentSelfLabel;
      existing.parent_label = newParentOtherLabel;
    } else {
      newState.parents.push({
        parent_shortname: newParent,
        parent_title: itemMap[newParent],
        child_label: newParentSelfLabel,
        parent_label: newParentOtherLabel,
      });
    }
    onUpdate(newState);
  };

  const addChild = () => {
    const newState = { ...item };
    if (!newChild) return;
    const existing = newState.children.find((child) => child.child_shortname === newChild);
    if (existing) {
      existing.parent_label = newChildSelfLabel;
      existing.child_label = newChildOtherLabel;
    } else {
      newState.children.push({
        child_shortname: newChild,
        child_title: itemMap[newChild],
        parent_label: newChildSelfLabel,
        child_label: newChildOtherLabel,
      });
    }
    onUpdate(newState);
  };

  return <div>
    <div className='item-parents'>
      <h4>{T('Parents')}</h4>
      {item.parents.map((parent, i) => (
        <div key={`parent_${i}`}>
          <button onClick={() => deleteParent(i)}>{parent.parent_title}</button>
          {parent.parent_label && <span>{parent.parent_label}</span>}
        </div>
      ))}
    </div>
    <div className='item-children'>
      <h4>{T('Children')}</h4>
      {item.children.map((child, i) => (
        <div key={`child_${i}`}>
          <button onClick={() => deleteChild(i)}>{child.child_title}</button>
          {child.child_label && <span>{child.child_label}</span>}
        </div>
      ))}
    </div>
    <div>
      <button onClick={addParent}>{T('Add New Parent')}</button>
      <SearchableSelect options={itemMap} onSelect={setNewParent} />
      <input
        value={newParentSelfLabel}
        onChange={({ target }) => setNewParentSelfLabel(target.value)}
        placeholder={T('%s\'s Title', item.title)}
      />
      <input
        value={newParentOtherLabel}
        onChange={({ target }) => setNewParentOtherLabel(target.value)}
        placeholder={T('Parent Title')}
      />
    </div>
    <div>
      <button onClick={addChild}>{T('Add New Child')}</button>
      <SearchableSelect options={itemMap} onSelect={setNewChild} />
      <input
        value={newChildSelfLabel}
        onChange={({ target }) => setNewChildSelfLabel(target.value)}
        placeholder={T('%s\'s Title', item.title)}
      />
      <input
        value={newChildOtherLabel}
        onChange={({ target }) => setNewChildOtherLabel(target.value)}
        placeholder={T('Child Title')}
      />
    </div>
  </div>;
}
