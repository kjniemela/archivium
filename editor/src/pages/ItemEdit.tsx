import type { SetImageOptions } from '@tiptap/extension-image';
import { useEditor } from '@tiptap/react';
import { useEffect, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router';
import type { Item } from '../../../src/api/models/item';
import { editorExtensions, extractLinkData, type LinkData, type TiptapContext } from '../../../src/lib/editor';
import { splitIgnoringQuotes } from '../../../src/lib/markdown';
import { indexedToJson, jsonToIndexed, type IndexedDocument } from '../../../src/lib/tiptapHelpers';
import CustomDataEditor from '../components/CustomDataEditor';
import EditorFrame from '../components/EditorFrame';
import Gallery from '../components/Gallery';
import LineageEditor from '../components/LineageEditor';
import SaveBtn from '../components/SaveBtn';
import TabsBar from '../components/TabsBar';
import TimelineEditor from '../components/TimelineEditor';
import { BulkExistsFetcher, capitalize, fetchData, T } from '../helpers';

type Categories = {
  [key: string]: [string, string],
};

export type EventItem = [string, string, number, string, number];

const BUILTIN_TABS = ['lineage', 'location', 'timeline', 'gallery'] as const;

type ObjData = {
  notes?: boolean,
  comments?: boolean,
  body?: IndexedDocument,
  tabs?: { [key: string]: any },
} & { [K in typeof BUILTIN_TABS[number]]?: any };

type ModalType = 'newTab';

export type ItemEditProps = {
  universeLink: (universe: string) => string,
};

function computeTabs(objData: ObjData): Record<string, string> {
  return {
    ...(objData.body ? { body: T('Main Text') } : {}),
    ...(objData.tabs ? Object.keys(objData.tabs) : []).reduce((acc, tab) => ({ ...acc, [tab]: tab }), {}),
    ...BUILTIN_TABS.filter(tab => objData[tab] !== undefined).reduce((acc, tab) => ({ ...acc, [tab]: objData[tab].title }), {}),
  };
}

const itemExistsCache: { [universe: string]: { [item: string]: boolean } } = {};

export default function ItemEdit({ universeLink }: ItemEditProps) {
  const navigate = useNavigate();
  const { universeShort, itemShort } = useParams();

  if (!universeShort || !itemShort) return;

  const [initContent, setInitContent] = useState<any | null>(null);
  const [categories, setCategories] = useState<Categories | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [objData, setObjData] = useState<ObjData | null>(null);
  const [currentModal, setCurrentModal] = useState<ModalType | null>(null);
  const [currentTab, setCurrentTab] = useState<string | null>(null);
  const [tabNames, setTabNames] = useState<Record<string, string>>({});
  const [eventItemMap, setEventItemMap] = useState<Record<number, EventItem[]>>();
  const [lineageItemMap, setLineageItemMap] = useState<Record<number, string>>();

  const context: TiptapContext = {
    currentUniverse: universeShort,
    universeLink,
    itemExists(universe, item): boolean {
      return (itemExistsCache[universe] ?? {})[item] ?? false;
    },
    headings: [],
  };
  
  const editor = useEditor({
    extensions: editorExtensions(true, context),
    onUpdate: ({ editor }) => {
      if (!objData) return;
      const json = editor.getJSON();
      const indexed = jsonToIndexed(json);
      setObjData({ ...objData, body: indexed });
    },
  });

  useEffect(() => {
    const categoryPromise = fetchData(`/api/universes/${universeShort}`, (data) => {
      setCategories(data.obj_data.cats);
    });
    const eventItemPromise = fetchData(`/api/universes/${universeShort}/events`, (events) => {
      const newEventItemMap: Record<number, EventItem[]> = {};
      for (const { src_id, src_title, src_shortname, event_title, abstime } of events) {
        if (!(src_id in newEventItemMap)) {
          newEventItemMap[src_id] = [];
        }
        newEventItemMap[src_id].push([src_shortname as string, src_title as string, Number(src_id), event_title ?? '', Number(abstime)]);
      }
      setEventItemMap(newEventItemMap);
    });
    const lineageItemPromise = fetchData(`/api/universes/${universeShort}/items?type=character`, (items) => {
      const newLineageItemMap: Record<number, string> = {};
      for (const { shortname, title } of items) {
        if (shortname === itemShort) continue;
        newLineageItemMap[shortname] = title;
      }
      setLineageItemMap(newLineageItemMap);
    });
    fetchData(`/api/universes/${universeShort}/items/${itemShort}`, async (data) => {
      await Promise.all([categoryPromise, eventItemPromise, lineageItemPromise]);
      const objData = JSON.parse(data.obj_data) as ObjData;
      if (objData.body) {
        const links: LinkData[] = []; 
        const json = indexedToJson(objData.body, (href) => links.push(extractLinkData(href)));
        const bulkFetcher = new BulkExistsFetcher();
        const fetchPromises = links.map(async (link) => {
          if (link.item) {
            const universe = link.universe ?? universeShort;
            if (!(universe in itemExistsCache)) {
              itemExistsCache[universe] = {};
            }
            if (!(link.item in itemExistsCache[universe])) {
              itemExistsCache[universe][link.item] = await bulkFetcher.exists(universe, link.item);
            }
          }
        });
        bulkFetcher.fetchAll();
        await Promise.all(fetchPromises);
        setInitContent(json);
      }
      delete data.obj_data;
      setObjData(objData);
      setTabNames(computeTabs(objData));
      setItem(data);
    });
  }, [itemShort, universeShort]);

  useEffect(() => {
    if (editor && initContent) {
      editor.commands.setContent(initContent);
    }
  }, [editor, initContent]);

  useEffect(() => {
    if (!(currentTab && tabNames[currentTab])) {
      if (Object.keys(tabNames).length > 0) setCurrentTab(Object.keys(tabNames)[0]);
      else setCurrentTab(null);
    }
  }, [tabNames]);

  const modalAnchor = document.querySelector('#modal-anchor');

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
          <option value='body' disabled={'body' in objData}>{T('Main Text')}</option>
          {BUILTIN_TABS.map(type => (
            <option key={type} value={type} disabled={type in tabNames}>{capitalize(T(type))}</option>
          ))}
          <option value='custom'>{T('Custom Data')}</option>
        </select>
        {newTabType === 'custom' && <input type='text' placeholder={T('Tab Name')} value={newTabName} onChange={({ target }) => setNewTabName(target.value)} />}
        <button type='button' onClick={() => addTabByType()}>{T('New Tab')}</button>
      </div>
    ),
  };

  const customTabs: Record<string, ReactElement> = {};
  for (const tab in objData.tabs) {
    customTabs[tab] = <CustomDataEditor data={objData.tabs[tab]} onUpdate={(newData) => {
      const newState = { ...objData };
      if (!newState.tabs) newState.tabs = {};
      newState.tabs[tab] = newData;
      setObjData(newState);
    }} />;
  }

  const tabs: Record<string, ReactElement | null> = {
    ...customTabs,
    body: (
      <EditorFrame editor={editor} getLink={async (previousUrl, type) => {
        const url = window.prompt('URL', previousUrl);
        if (url?.startsWith('@')) {
          if (type === 'link') {
            const link = extractLinkData(url);
            if (link.item) {
              const universe = link.universe ?? universeShort;
              if (!(universe in itemExistsCache)) {
                itemExistsCache[universe] = {};
              }
              if (!(link.item in itemExistsCache[universe])) {
                const existsFetcher = new BulkExistsFetcher();
                const fetchPromise = existsFetcher.exists(universe, link.item);
                existsFetcher.fetchAll();
                itemExistsCache[universe][link.item] = await fetchPromise;
              }
            }
          } else if (type === 'image') {
            const [cmd, index, alt, height, width] = splitIgnoringQuotes(url.substring(1));
            if (cmd === 'img') {
              const image = item.gallery[Number(index)];
              if (image) {
                const attrs: Partial<SetImageOptions> = {
                  alt: alt ?? image.name,
                  title: alt ?? image.label,
                };
                if (height) attrs.height = Number(height);
                if (width) attrs.width = Number(width);
                return [`/api/universes/${item.universe_short}/items/${item.shortname}/gallery/images/${image.id}`, attrs];
              }
            }
          }
        }
        return [url];
      }} />
    ),
    gallery: (
      <Gallery universe={universeShort} item={itemShort} images={item.gallery} onRemoveImage={(id) => {
        const newState = { ...item };
        for (let i = 0; i < newState.gallery.length; i++) {
          const img = newState.gallery[i];
          if (img.id === id) {
            newState.gallery.splice(i, 1);
            break;
          }
        }
        setItem(newState);
      }} onUploadImage={(img) => {
        const newState = { ...item };
        newState.gallery.push(img);
        setItem(newState);
      }} onChangeLabel={(id, label) => {
        const newState = { ...item };
        for (let i = 0; i < newState.gallery.length; i++) {
          const img = newState.gallery[i];
          if (img.id === id) {
            img.label = label;
            break;
          }
        }
        setItem(newState);
      }} onReorderImages={(newImages) => {
        setItem(prev => prev ? ({
          ...prev,
          gallery: newImages,
        }) : prev);
      }} />
    ),
    timeline: (
      <TimelineEditor item={item} onEventsUpdate={(newEvents) => {
        const newState = { ...item };
        console.log(newEvents)
        newState.events = newEvents;
        setItem(newState);
      }} eventItemMap={eventItemMap ?? {}} />
    ),
    lineage: (
      <LineageEditor item={item} onUpdate={(newItem) => setItem(newItem)} itemMap={lineageItemMap ?? {}} />
    ),
  };

  return (
    <>
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
      <div className='d-flex justify-between align-baseline'>
        <h2>{T('Edit %s', item.title)}</h2>
        <a className='link link-animated color-error' href={`${context.universeLink(universeShort)}/items/${itemShort}`}>{T('Discard Changes')}</a>
      </div>
      <div id='edit' className='form-row-group'>
        <div className='inputGroup'>
          <label htmlFor='title'>{T('Title')}</label>
          <input id='title' type='text' name='title' value={item.title} onChange={({ target }) =>
            setItem({ ...item, title: target.value })
          } />
        </div>

        <div className='inputGroup'>
          <label htmlFor='shortname'>{T('Shortname')}:</label>
          <input id='shortname' type='text' name='shortname' value={item.shortname} onChange={({ target }) =>
            setItem({ ...item, shortname: target.value })
          } />
        </div>

        <div className='inputGroup'>
          <small style={{ gridColumn: '2 / 4' }}>
            <i>{T('NOTE: other users currently editing this item will be unable to save their work. Change with caution.')}</i>
          </small>
        </div>

        <div className='inputGroup'>
          <label htmlFor='item_type'>{T('Type')}:</label>
          <select id='item_type' name='item_type' defaultValue={item.item_type} onChange={({ target }) => item && setItem({ ...item, item_type: target.value })}>
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
          <textarea id='tags' name='tags' value={item.tags.join(' ')} onChange={({ target }) => item && setItem({ ...item, tags: target.value.split(' ') })} />
        </div>

        <div className='inputGroup'>
          <label htmlFor='comments'>{T('Enable comments')}:</label>
          <label className='switch'>
            <input id='comments' name='comments' type='checkbox' checked={objData?.comments ?? false} onChange={({ target }) =>
              setObjData({ ...objData, comments: target.checked })
            } />
            <span className='slider'></span>
          </label>
        </div>

        <div className='inputGroup'>
          <label htmlFor='notes'>{T('Enable notes')}:</label> 
          <label className='switch'>
            <input id='notes' name='notes' type='checkbox' checked={objData?.notes ?? false} onChange={({ target }) =>
              setObjData({ ...objData, notes: target.checked })
            } />
            <span className='slider'></span>
          </label>
        </div>

        <div className='mt-2'>
          <SaveBtn<Item>
            data={{ ...item, obj_data: objData }}
            saveUrl={`/api/universes/${universeShort}/items/${itemShort}`}
            previewUrl={`${context.universeLink(universeShort)}/items/${item.shortname}`}
            onSave={(data) => {
              if (data.shortname !== itemShort) {
                navigate(`/editor/universes/${universeShort}/items/${data.shortname}`);
              }
            }}
          />
        </div>

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

          {currentTab && (
            <div data-tab={currentTab}>
              {tabs[currentTab]}
            </div>
          )}
        </div>}
      </div>
    </>
  );
}
