import { useState } from 'react';
import { T } from '../helpers';

type CustomDataEditorProps = {
  data: { [key: string]: any },
  onUpdate: (newData: { [key: string]: any }) => void,
};

export default function CustomDataEditor({ data, onUpdate }: CustomDataEditorProps) {
  const [newKey, setNewKey] = useState<string>('');

  const updateKey = (key: string, value: any) => {
    const newState = { ...data };
    newState[key] = value;
    onUpdate(newState);
  };

  const addKey = () => {
    const newState = { ...data };
    if (!newKey || newKey in data) return;
    newState[newKey] = null;
    setNewKey('');
    onUpdate(newState);
  };

  const removeKey = (key: string) => {
    const newState = { ...data };
    if (!(key in data)) return;
    delete newState[key];
    onUpdate(newState);
  };

  return <div>
    <div className='keyPairs'>
      {Object.keys(data).map((key) => (
        <div key={key}>
          <label>{key}: </label>
          <input value={data[key]} onChange={({ target }) => updateKey(key, target.value)} />
          <button onClick={() => removeKey(key)}>{T('Remove')}</button>
        </div>
      ))}
    </div>
    <button onClick={addKey}>{T('Add New Key')}</button>
    <input value={newKey} onChange={({ target }) => setNewKey(target.value)} />
  </div>;
}
