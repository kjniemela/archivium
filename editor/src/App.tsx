import { useState, useEffect } from 'react';
import { capitalize } from './helpers';
import RichEditor from './components/RichEditor';

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
  notes: boolean,
  comments: boolean,
  body: string,
};

export type AppProps = {
  itemShort?: string,
  universeShort?: string,
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

export default function App({ itemShort, universeShort }: AppProps) {
  const [categories, setCategories] = useState<Categories | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [objData, setObjData] = useState<ObjData | null>(null);

  useEffect(() => {
    fetchData(`/api/universes/${universeShort}`, (data) => {
      setCategories(data.obj_data.cats);
    });
    fetchData(`/api/universes/${universeShort}/items/${itemShort}`, (data) => {
      setObjData(JSON.parse(data.obj_data));
      delete data.obj_data;
      setItem(data);
    });
  }, [itemShort, universeShort]);

  return (
    <>
      <h2>{item ? T('Edit %s', item.title) : T('Edit')}</h2>
      <form id='edit' method='POST'>
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
          <button type='submit'>{T('Save Changes')}</button>
        </div>

        {objData && <RichEditor content={objData.body} />}
      </form>
    </>
  )
}
