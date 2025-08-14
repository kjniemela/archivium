import { useState, useEffect, type ReactElement } from 'react';
import { capitalize, deepCompare, renderMarkdown, T } from './helpers';
import EditorFrame from './components/EditorFrame';
import { indexedToJson, jsonToIndexed, type IndexedDocument } from '../../src/lib/tiptapHelpers';
import { editorExtensions } from '../../src/lib/editor';
import { createPortal } from 'react-dom';
import TabsBar from './components/TabsBar';
import { useEditor } from '@tiptap/react';
import Gallery, { type GalleryImage } from './components/Gallery';

type Categories = {
  [key: string]: [string, string],
};

type Item = {
  title: string,
  shortname: string,
  itemType: string,
  tags: string[],
  gallery: GalleryImage[],
};

const BUILTIN_TABS = ['lineage', 'location', 'timeline', 'gallery'] as const;

type ObjData = {
  notes?: boolean,
  comments?: boolean,
  body?: IndexedDocument,
  tabs?: { [key: string]: any },
} & { [K in typeof BUILTIN_TABS[number]]?: any };

type ModalType = 'newTab';

export type AppProps = {
  itemShort: string,
  universeShort: string,
};

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

let timeoutId: NodeJS.Timeout | null = null;
function debouncedOnUpdate(editor: any, onChange: (content: IndexedDocument) => void) {
  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  timeoutId = setTimeout(() => {
    const json = editor.getJSON();
    const indexed = jsonToIndexed(json);
    onChange(indexed);
  }, 500);
}

let needsSaving = false;
export function setNeedsSaving(value: boolean) {
  needsSaving = value;
}
window.onbeforeunload = (event) => {
  if (needsSaving) {
    event.preventDefault();
    event.returnValue = true;
  }
};
let saveTimeout: NodeJS.Timeout | null = null;
let previousData: (Item & { obj_data: ObjData }) | null = null;

const saveBtn = document.getElementById('save-btn');
if (saveBtn) {
  saveBtn.addEventListener('click', () => {
    const saveChangesBtn = document.getElementById('save-changes');
    saveChangesBtn?.click();
  });
}

function computeTabs(objData: ObjData): Record<string, string> {
  return {
    ...(objData.body ? { body: T('Main Text') } : {}),
    ...(objData.tabs ? Object.keys(objData.tabs) : []).reduce((acc, tab) => ({ ...acc, [tab]: tab }), {}),
    ...BUILTIN_TABS.filter(tab => objData[tab] !== undefined).reduce((acc, tab) => ({ ...acc, [tab]: objData[tab].title }), {}),
  };
}

export default function App({ itemShort, universeShort }: AppProps) {
  const [categories, setCategories] = useState<Categories | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [objData, setObjData] = useState<ObjData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveText, setSaveText] = useState<string>('Save Changes');
  const [currentModal, setCurrentModal] = useState<ModalType | null>(null);
  const [currentTab, setCurrentTab] = useState<string | null>(null);
  const [tabNames, setTabNames] = useState<Record<string, string>>({});
  
  const editor = useEditor({
    extensions: editorExtensions,
    onUpdate: ({ editor }) => {
      if (!objData) return;
      debouncedOnUpdate(editor, (content) => setObjData({ ...objData, body: content }));
    },
  });
  
  async function save(delay: number) {
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
        setNeedsSaving(false);
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
        setNeedsSaving(false);
      } catch (err) {
        console.error('Failed to save!');
        console.error(err);
        setSaveText('Error');
        previousData = null;
        if (err instanceof TypeError) {
          setErrorMessage('Network error. Make sure you are connected to the internet and try again.');
        }
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
      setTabNames(computeTabs(objData));
      if (typeof objData.body === 'string') {
        renderMarkdown(universeShort, objData.body, { item: { ...data, obj_data: objData } }).then((text: string) => {
          editor.commands.setContent(text);
        });
      } else if (objData.body) {
        const json = indexedToJson(objData.body);
        editor.commands.setContent(json);
      }
      delete data.obj_data;
      setItem(data);
    });
  }, [itemShort, universeShort]);

  useEffect(() => {
    if (item && objData) {
      setNeedsSaving(true);
      setSaveText('Save Changes');
      save(5000);
    }
  }, [item, objData]);

  useEffect(() => {
    if (!(currentTab && tabNames[currentTab])) {
      if (Object.keys(tabNames).length > 0) setCurrentTab(Object.keys(tabNames)[0]);
      else setCurrentTab(null);
    }
  }, [tabNames]);

  const modalAnchor = document.querySelector('#modal-anchor');
  const saveBtnAnchor = document.querySelector('#save-btn');

  const [newTabType, setNewTabType] = useState<string | undefined>(undefined);
  const [newTabName, setNewTabName] = useState<string>('');
  function addTabByType() {
    if (!objData || newTabType === undefined) return;
    let newObjData = { ...objData };
    if (BUILTIN_TABS.includes(newTabType as typeof BUILTIN_TABS[number])) {
      newObjData[newTabType as typeof BUILTIN_TABS[number]] = { title: capitalize(T(newTabType)) };
    } else if (newTabType === 'body') {
      newObjData.body = { text: '', structure: [] };
    } else if (newTabType === 'custom') {
      if (!newTabName) return;
      if (!newObjData.tabs) newObjData.tabs = {};
      newObjData.tabs[newTabName] = {};
    }
    setObjData(newObjData);
    setTabNames(computeTabs(newObjData));
    setCurrentModal(null);
  }
  function removeTab(tab: string) {
    if (!objData) return;
    let newObjData = { ...objData };
    if (BUILTIN_TABS.includes(tab as typeof BUILTIN_TABS[number])) {
      delete newObjData[tab as typeof BUILTIN_TABS[number]];
    } else if (tab === 'body') {
      delete newObjData.body;
    } else if (newObjData.tabs) {
      if (!newObjData.tabs[tab]) return;
      delete newObjData.tabs[tab];
    }
    setObjData(newObjData);
    setTabNames(computeTabs(newObjData));
  }

  /* Loading Screen */
  if (!item || !objData) {
    return <div className='d-flex justify-center align-center'>
      <div className='loader' style={{ marginTop: 'max(0px, calc(50vh - 50px - var(--page-margin-top)))' }}></div>
    </div>;
  }

  const modals: Record<ModalType, ReactElement> = {
    newTab: (
      <div className='sheet d-flex flex-col gap-1' style={{ minWidth: '20rem' }}>
        <select onChange={({ target }) => setNewTabType(target.value)}>
          <option hidden disabled selected value={undefined}>{T('Tab Type')}...</option>
          <option value='body' disabled={'body' in ['currentTabs']}>{T('Main Text')}</option>
          {BUILTIN_TABS.map(type => (
            <option key={type} value={type} disabled={type in ['currentTabs']}>{capitalize(T(type))}</option>
          ))}
          <option value='custom'>{T('Custom Data')}</option>
        </select>
        {newTabType === 'custom' && <input type='text' placeholder={T('Tab Name')} value={newTabName} onChange={({ target }) => setNewTabName(target.value)} />}
        <button type='button' onClick={() => addTabByType()}>{T('New Tab')}</button>
      </div>
    ),
  };

  const tabs: Record<string, ReactElement | null> = {
    body: (
      <EditorFrame editor={editor} />
    ),
    gallery: (
      <Gallery universe={universeShort} item={itemShort} images={item.gallery} onRemoveImage={(id) => {
        let newState = { ...item };
        for (let i = 0; i < newState.gallery.length; i++) {
          const img = newState.gallery[i];
          if (img.id === id) {
            newState.gallery.splice(i, 1);
            break;
          }
        }
        setItem(newState);
      }} onUploadImage={(img) => {
        let newState = { ...item };
        newState.gallery.push(img);
        setItem(newState);
      }} onChangeLabel={(id, label) => {
        let newState = { ...item };
        for (let i = 0; i < newState.gallery.length; i++) {
          const img = newState.gallery[i];
          if (img.id === id) {
            img.label = label;
            break;
          }
        }
        setItem(newState);
      }} />
    ),
  };

  return (
    <>
      {/* Save Button */}
      {saveBtnAnchor && createPortal(
        <a className='navbarBtnLink navbarText'>{T(saveText)}</a>,
        saveBtnAnchor,
      )}
      {/* Modals */}
      {modalAnchor && (
        currentModal && createPortal(
          <div className='modal' onClick={() => setCurrentModal(null)}>
            <div className='modal-content' onClick={(e) => e.stopPropagation()}>
              {modals[currentModal]}
            </div>
          </div>,
          modalAnchor
        )
      )}
      {/* Editor Page */}
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
          <button id='save-changes' onClick={() => save(0)}>{T(saveText)}</button>
        </div>

        {errorMessage && <div>
          <span id='item-error' className='color-error' style={{ fontSize: 'small' }}>{errorMessage}</span>
        </div>}

        <hr className='w-100 mb-0' />

        {objData && <div>
          <div className='d-flex align-start mb-2'>
            <TabsBar tabs={tabNames} selectedTab={currentTab} onSelectTab={(tab) => setCurrentTab(tab)} onRemoveTab={(tab) => removeTab(tab)} />
            <ul className='navbarBtns'>
              <li className='navbarBtn'>
                <h3 className='navbarBtnLink navbarText ma-0 material-symbols-outlined heavy' onClick={() => setCurrentModal('newTab')}>add</h3>
              </li>
            </ul>
          </div>

          {currentTab && tabs[currentTab]}
        </div>}
      </div>
    </>
  )
}
