import { useState, useEffect } from 'react';
import { capitalize, deepCompare, renderMarkdown } from './helpers';
import RichEditor from './components/RichEditor';
import { indexedToJson, type IndexedDocument } from '../../src/lib/tiptapHelpers';

type Categories = {
  [key: string]: [string, string],
};

type Item = {
  title: string,
  shortname: string,
  itemType: string,
  tags: string[],
};

type ObjData = {
  notes?: boolean,
  comments?: boolean,
  body: IndexedDocument,
};

export type AppProps = {
  itemShort: string,
  universeShort: string,
};

function sprintf(format: string, ...args: string[]): string {
  let i = 0;
  return format.replace(/%s/g, () => args[i++]);
}

function T(str: string, ...args: string[]): string {
// return sprintf(locale[lang][str] ?? str, ...args);
  return sprintf(str, ...args);
}

async function fetchData(url: string, setter: (value: any) => void): Promise<any> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!res.ok) throw new Error('Failed to fetch');
    const data = await res.json();
    setter(data);
  } catch (err) {
    console.error(err);
  }
}

function setSaveText(text: string) {
  const saveBtn = document.getElementById('save-btn');
  if (saveBtn && saveBtn.firstChild) {
    saveBtn.firstChild.textContent = text;
  }
}

let needsSaving = false;
let saveTimeout: NodeJS.Timeout | null = null;
let previousData: (Item & { obj_data: ObjData }) | null = null;


const saveBtn = document.getElementById('save-btn');
if (saveBtn) {
  saveBtn.addEventListener('click', () => {
    const saveChangesBtn = document.getElementById('save-changes');
    saveChangesBtn?.click();
  });
}

export default function App({ itemShort, universeShort }: AppProps) {
  const [categories, setCategories] = useState<Categories | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [objData, setObjData] = useState<ObjData | null>(null);
  const [initBodyData, setInitBodyData] = useState<string | Object | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  
  async function save(delay=5000) {
    console.log(objData);
    console.log(item);
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(async () => {
      if (!item || !objData) return;
      setSaveText('Saving...');
      console.log('SAVING...');
      const data = {
        ...item,
        obj_data: { ...objData },
      };

      if (deepCompare(data, previousData)) {
        console.log('NO CHANGE');
        setSaveText('Saved');
        needsSaving = false;
        return;
      }

      try {
        setErrorMessage(null);
        const response = await fetch(`/api/universes/${universeShort}/items/${itemShort}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        })
        const err = await response.json();
        if (!response.ok) {
          setErrorMessage(err);
          throw err;
        }
        console.log('SAVED.');
        setSaveText('Saved');
        previousData = data;
        needsSaving = false;
      } catch (err) {
        console.error('Failed to save!');
        console.error(err);
        setSaveText('Error');
        previousData = null;
      }
    }, delay);
  }

  useEffect(() => {
    fetchData(`/api/universes/${universeShort}`, (data) => {
      setCategories(data.obj_data.cats);
    });
    fetchData(`/api/universes/${universeShort}/items/${itemShort}`, (data) => {
      const objData = JSON.parse(data.obj_data) as ObjData;
      setObjData(objData);
      if (typeof objData.body === 'string') {
        renderMarkdown(universeShort, objData.body, { item: { ...data, obj_data: objData } }).then((text: string) => {
          setInitBodyData(text);
        });
      } else {
        const json = indexedToJson(objData.body);
        setInitBodyData(json);
      }
      delete data.obj_data;
      setItem(data);
    });
  }, [itemShort, universeShort]);

  return (
    <>
      <h2>{item ? T('Edit %s', item.title) : T('Edit')}</h2>
      <div id='edit' className='form-row-group'>
        <div className='inputGroup'>
          <label htmlFor='title'>{T('Title')}</label>
          <input id='title' type='text' name='title' value={item?.title ?? ''} onChange={({ target }) =>
            item && setItem({ ...item, title: target.value })
          } />
        </div>

        <div className='inputGroup'>
          <label htmlFor='shortname'>{T('Shortname')}:</label>
          <input id='shortname' type='text' name='shortname' value={item?.shortname ?? ''} onChange={({ target }) =>
            item && setItem({ ...item, shortname: target.value })
          } />
        </div>

        <div className='inputGroup'>
          <small style={{ gridColumn: '2 / 4' }}>
            <i>{T('NOTE: changes to the shortname will not auto-save.')}</i>
            <br />
            <i>{T('Other users currently editing this item will be unable to save their work. Change with caution.')}</i>
          </small>
        </div>

        <div className='inputGroup'>
          <label htmlFor='item_type'>{T('Type')}:</label>
          <select id='item_type' name='item_type' defaultValue={item?.itemType} onChange={({ target }) => item && setItem({ ...item, itemType: target.value })}>
            <option hidden disabled>{T('Select one')}...</option>
            {(categories && item) && Object.keys(categories).map(type => (
              <option key={type} value={type}>
                {capitalize(categories[type][0])}
              </option>
            ))}
          </select>
        </div>

        <div className='inputGroup'>
          <label htmlFor='tags'>{T('Tags')}:</label>
          <textarea id='tags' name='tags' value={(item?.tags ?? []).join(' ')} onChange={({ target }) => item && setItem({ ...item, tags: target.value.split(' ') })} />
        </div>

        <div className='inputGroup'>
          <label htmlFor='comments'>{T('Enable comments')}:</label>
          <label className='switch'>
            <input id='comments' name='comments' type='checkbox' checked={objData?.comments ?? false} onChange={({ target }) =>
              objData && setObjData({ ...objData, comments: target.checked })
            } />
            <span className='slider'></span>
          </label>
        </div>

        <div className='inputGroup'>
          <label htmlFor='notes'>{T('Enable notes')}:</label> 
          <label className='switch'>
            <input id='notes' name='notes' type='checkbox' checked={objData?.notes ?? false} onChange={({ target }) =>
              objData && setObjData({ ...objData, notes: target.checked })
            } />
            <span className='slider'></span>
          </label>
        </div>

        <div className='mt-2'>
          <button id='save-changes' onClick={() => save(0)}>{T('Save Changes')}</button>
        </div>

        {errorMessage && <div>
          <span id='item-error' className='color-error' style={{ fontSize: 'small' }}>{errorMessage}</span>
        </div>}

        {initBodyData && <RichEditor content={initBodyData} onChange={(content) => {
          setObjData({ ...objData, body: content });
        }} />}
      </div>
    </>
  )
}
