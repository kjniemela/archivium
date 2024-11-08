let obj_data = {};
let itemMap = {};
let selectedTab = null;

if (!window.createElement) throw 'domUtils not loaded!';
if (!window.createSearchableSelect) throw 'searchableSelect not loaded!';
if (!window.modal) throw 'modal not loaded!';
if (!window.getJSON) throw 'fetchUtils.js not loaded!';
if (!window.CalendarPicker) throw 'calendarPicker.js not loaded!';
if (!window.uploadImage) throw 'fileUpload.js not loaded!';

function getIdValue(id) {
  return document.getElementById(id).value;
}

function updateObjData(newState) {
  obj_data = { ...obj_data, ...newState };
  const objDataInput = document.getElementById('obj_data');
  objDataInput.value = encodeURIComponent(JSON.stringify(obj_data));
}

function bindDataValue(selector, setter) {
  const el = document.querySelector(selector);
  el.oninput = () => {
    setter(el.value);
  };
  el.oninput();
}


function createBody() {
  updateObjData({ body: '' });
  document.querySelector('#body').appendChild(createElement('textarea'));
  bindDataValue('#body textarea', (body) => updateObjData({ body }));
  document.querySelector('#body button').remove();
}


function selectTab(name) {
  if (selectedTab) document.querySelector(`#tabs [data-tab="${selectedTab}"]`).classList.add('hidden');
  document.querySelector(`#tabs [data-tab="${name}"]`).classList.remove('hidden');
  selectedTab = name;
}


async function addTab(type, name, force=false) {
  if (!('tabs' in obj_data)) obj_data.tabs = {};
  if (!name || (name in obj_data.tabs && !force)) return;

  if (!force) {
    const newState = {...obj_data};
    if (type === 'custom') newState.tabs[name] = {};
    else {
      if (!(type in newState)) newState[type] = {};
      newState[type].title = name;
    }
    updateObjData(newState);
  }

  const button = createElement('button', {
    attrs: {
      type: 'button',
      innerText: name,
      onclick: () => selectTab(name),
    },
    dataset: { tabBtn: name },
  });
  document.querySelector('#tabs .tabs-buttons').appendChild(button);

  const content = createElement('div', { classList: ['hidden'], dataset: { tab: name }, children: [
    createElement('button', { attrs: {
      type: 'button',
      innerText: 'Delete Tab',
      onclick: () => {
        if (type !== 'custom') {
          updateObjData({ [type]: {} });
        }
        removeTab(name);
      },
    } }),
    createElement('h3', { attrs: { innerText: name } }),
    type === 'custom' && createElement('div', { children: [
      createElement('div', { classList: ['keyPairs'] }),
      createElement('button', { attrs: {
        type: 'button',
        innerText: 'Add New Key',
        onclick: () => addKeyValuePair(name, getIdValue(`${name}-new_key`)),
      } }),
      createElement('input', { attrs: { id: `${name}-new_key` } }),
    ] }),
    type === 'lineage' && createElement('div', { children: [
      createElement('div', { classList: ['item-parents'], children: [
        createElement('h4', { attrs: { innerText: 'Parents' } }),
        ...Object.keys(obj_data.lineage.parents ?? {}).map((shortname) => (
          createElement('div', { children: [
            createElement('button', { attrs: {
              type: 'button',
              innerText: itemMap[shortname] ?? shortname,
              onclick: () => {
                const newState = { ...obj_data };
                delete newState.lineage.parents[shortname];
                updateObjData(newState);
                resetTabs(name);
              },
            } }),
            obj_data.lineage.parents[shortname][0]
              && createElement('span', { attrs: { innerText: obj_data.lineage.parents[shortname][0] } }),
          ] })
        )),
      ] }),
      createElement('div', { classList: ['item-children'], children: [
        createElement('h4', { attrs: { innerText: 'Children' } }),
        ...Object.keys(obj_data.lineage.children ?? {}).map((shortname) => (
          createElement('div', { children: [
            createElement('button', { attrs: {
              type: 'button',
              innerText: itemMap[shortname],
              onclick: () => {
                const newState = { ...obj_data };
                delete newState.lineage.children[shortname];
                updateObjData(newState);
                resetTabs(name);
              },
            } }),
            obj_data.lineage.children[shortname][0]
              && createElement('span', { attrs: { innerText: obj_data.lineage.children[shortname][0] } }),
          ] })
        )),
      ] }),
      createElement('div', { children: [
        createElement('button', { attrs: {
          type: 'button',
          innerText: 'Add New Parent',
          onclick: () => {
            const val = getIdValue('new_parent');
            const data = [getIdValue('new_parent_other_data') || null, getIdValue('new_parent_self_data') || null];
            if (!val) return;
            const newState = { ...obj_data };
            if (!('parents' in newState.lineage)) newState.lineage.parents = {};
            newState.lineage.parents[val] = data;
            updateObjData(newState);
            resetTabs(name);
          },
        } }),
        createSearchableSelect('new_parent', itemMap),
        createElement('input', { attrs: { id: 'new_parent_self_data', placeholder: T('Child Title') } }),
        createElement('input', { attrs: { id: 'new_parent_other_data', placeholder: T('Parent Title') } }),
      ] }),
      createElement('div', { children: [
        createElement('button', { attrs: {
          type: 'button',
          innerText: 'Add New Child',
          onclick: () => {
            const val = getIdValue('new_child');
            const data = [getIdValue('new_child_other_data') || null, getIdValue('new_child_self_data') || null];
            if (!val) return;
            const newState = { ...obj_data };
            if (!('children' in newState.lineage)) newState.lineage.children = {};
            newState.lineage.children[val] = data;
            updateObjData(newState);
            resetTabs(name);
          },
        } }),
        createSearchableSelect('new_child', itemMap),
        createElement('input', { attrs: { id: 'new_child_self_data', placeholder: T('Parent Title') } }),
        createElement('input', { attrs: { id: 'new_child_other_data', placeholder: T('Child Title') } }),
      ] }),
    ] }),
    type === 'timeline' && createElement('div', { children: [
      createElement('h4', { attrs: { innerText: T('Events') } }),
      ...(obj_data.timeline.events ?? []).sort((a, b) => a.time > b.time ? 1 : -1).map((event, i) => (
        createElement('div', { children: [
          ...(event.imported ? [
            createElement('span', { attrs: { innerText: `${event.title ? `${event.title} of ` : ``}${event.src}: ${event.time}` } }),
          ] : [
            createElement('input', { attrs: { value: event.title, placeholder: T('Title'), oninput: ({ target }) => {
              const newState = { ...obj_data };
              newState.timeline.events[i].title = target.value;
              updateObjData(newState);
            } } }),
            createElement('input', { attrs: { id: `${i}_event_time`, value: event.time, placeholder: T('Time'), type: 'number', oninput: ({ target }) => {
              const newState = { ...obj_data };
              newState.timeline.events[i].time = Math.round(Number(target.value));
              updateObjData(newState);
            }, onchange: ({ target }) => {
              target.value = Math.round(Number(target.value));
              resetTabs(name);
            } } }),
            ...timePickerModal(`${i}_event_time`, () => {
              const input = document.getElementById(`${i}_event_time`);
              input.oninput({ target: input });
            }),
          ]),
          createElement('button', { attrs: {
            type: 'button',
            innerText: T('Remove'),
            onclick: () => {
              const newState = { ...obj_data };
              newState.timeline.events.splice(i, 1);
              updateObjData(newState);
              resetTabs(name);
            },
          } }),
        ] })
      )),
      createElement('br'),
      createElement('h4', { attrs: { innerText: T('Add Events') } }),
      createElement('div', { classList: ['d-flex', 'flex-col', 'gap-1', 'pa-1', 'align-start'], children: [
        createElement('div', { children: [
          createElement('b', { attrs: { innerText: `${T('Title')}: ` } }),
          createElement('input', { attrs: { id: 'new_event_title' } }),
        ]}),
        createElement('div', { children: [
          createElement('b', { attrs: { innerText: `${T('Time')}: ` } }),
          createElement('input', { attrs: { id: 'new_event_time', type: 'number', onchange: ({ target }) => {
            target.value = Math.round(Number(target.value));
          } } }),
          ...timePickerModal('new_event_time'),
        ]}),
        createElement('button', { attrs: {
          type: 'button',
          innerText: T('Create New Event'),
          onclick: () => {
            const newState = { ...obj_data };
            const title = getIdValue('new_event_title');
            if (!title && newState.timeline.events?.some(({ title }) => !title)) {
              alert('Only one untitled event allowed per item!');
              return;
            }
            if (!newState.timeline.events) newState.timeline.events = [];
            newState.timeline.events.push({ title, time: getIdValue('new_event_time'), imported: false });
            updateObjData(newState);
            resetTabs(name);
          },
        } }),
      ] }),
      createElement('br'),
      createElement('div', { children: [
        ...(await importEventModal(([selectedItem, selectedEvent]) => {
          const newState = { ...obj_data };
          if (newState.timeline.imports?.some(({ item, event }) => selectedItem === item && selectedEvent === event)) return;
          if (!newState.timeline.imports) newState.timeline.imports = [];
          if (!newState.timeline.events) newState.timeline.events = [];
          newState.timeline.events.push({ ...selectedEvent, imported: true, src: selectedItem.title, srcId: selectedItem.id });
          newState.timeline.imports.push([selectedItem, selectedEvent]);
          updateObjData(newState);
          resetTabs(name);
        })),
      ] }),
    ] }),
    type === 'gallery' && createElement('div', { children: [
      createElement('div', { classList: ['item-gallery', 'd-flex', 'gap-4', 'flex-wrap'], children: [
        ...(obj_data.gallery.imgs ?? []).map(img => img ?? {}).map(({ url, label }, i) => (       
          createElement('div', { classList: [], children: [
            createElement('div', { classList: ['d-flex'], attrs: { style: 'height: 8rem;' }, children: [
              createElement('button', { attrs: {
                type: 'button',
                innerText: T('Remove Image'),
                onclick: () => {
                  const newState = { ...obj_data };
                  newState.gallery.imgs.splice(i, 1);
                  updateObjData(newState);
                  resetTabs(name);
                },
              } }),
              createElement('img', { attrs: { src: url, alt: label, style: { height: '2rem' } } }),
            ] }),
            label && createElement('span', { attrs: { innerText: label } }),
          ] })
        )),
      ] }),
      // createElement('button', { attrs: {
      //   type: 'button',
      //   innerText: 'Add New Image',
      //   onclick: () => {
      //     const url = getIdValue('new_gallery_image');
      //     const label = getIdValue('new_gallery_image_label');
      //     if (!url) return;
      //     const newState = { ...obj_data };
      //     if (!('imgs' in newState.gallery)) newState.gallery.imgs = [];
      //     newState.gallery.imgs.push({ url, label });
      //     updateObjData(newState);
      //     resetTabs(name);
      //   },
      // } }),
      // createElement('input', { attrs: { id: 'new_gallery_image', placeholder: T('Image URL') } }),
      createElement('button', { attrs: {
        type: 'button',
        innerText: 'Upload Image',
        onclick: () => {
          uploadImage(`/api/universes/${universe}/items/${item}/gallery/upload`, document.body, (newId, newName) => {
            const url = `/api/universes/${universe}/items/${item}/gallery/images/${newId}`;
            const label = getIdValue('new_gallery_image_label');
            if (!url) return;
            const newState = { ...obj_data };
            if (!('imgs' in newState.gallery)) newState.gallery.imgs = [];
            newState.gallery.imgs.push({ url, label, name: newName });
            updateObjData(newState);
            resetTabs(name);
          });
        },
      } }),
      createElement('input', { attrs: { id: 'new_gallery_image_label', placeholder: `${T('Image Label')} (${T('Optional')})` } }),
    ] }),
  ] });
  document.querySelector('#tabs .tabs-content').appendChild(content);

  if (!force) {
    selectTab(name);
  }

  if (type !== 'custom') {
    document.querySelector(`#new_tab_type [value="${type}"]`)?.remove();
  }
}

let eventItems = null;
let eventItemShorts = null;
let eventMap = null;
async function importEventModal(callback) {
  if (!eventItems) {
    const data = (await getJSON(`/api/universes/${universe}/items`))
      .filter(item => (item.events.length > 0));
    eventMap = data.reduce((acc, item) => ({ ...acc, [item.id]: item.events }), {});
    eventItems = data.reduce((acc, item) => ({ ...acc, [item.id]: item.title }), {});
    eventItemShorts = data.reduce((acc, item) => ({ ...acc, [item.id]: item.shortname }), {});
    console.log(eventMap, eventItems, eventItemShorts)
  }
  let selectedItem;
  const itemSelect = createSearchableSelect('import-event-item', eventItems, (value) => {
    selectedItem = { id: value, title: eventItems[value], shortname: eventItemShorts[value] };
    const events = eventMap[value].reduce((acc, [,,, key], i) => ({ ...acc, [i]: key || 'Default' }), {});
    eventSelect.setOptions(events);
    eventSelect.classList.remove('hidden');
  });
  let selectedEvent;
  const eventSelect = createSearchableSelect('import-event-event', eventItems, (value) => {
    const [,,, title, time] = (eventMap[selectedItem.id] ?? {})[value];
    selectedEvent = { title, time };
  });
  eventSelect.classList.add('hidden');
  return [
    modal('import-event', [
      createElement('div', { classList: ['sheet', 'd-flex', 'flex-col', 'gap-1'], children: [
        itemSelect,
        eventSelect,
        createElement('button', { attrs: {
          type: 'button',
          innerText: T('Import'), 
          onclick: () => {
            callback([selectedItem, selectedEvent]);
          },
        } }),
      ] }),
    ]),
    createElement('button', { attrs: {
      type: 'button',
      innerText: T('Import Event'), 
      onclick: () => {
        showModal('import-event');
      },
    } })
  ];
}

function timePickerModal(id, callback) {
  const cp = new CalendarPicker();
  return [
    modal(`time-picker-${id}`, [
      createElement('div', { classList: ['sheet', 'd-flex', 'flex-col', 'gap-1'], children: [
        ...cp.fields,
        createElement('button', { attrs: {
          type: 'button',
          innerText: T('Select'), 
          onclick: () => {
            document.getElementById(id).value = cp.getAbsTime();
            hideModal(`time-picker-${id}`);
            if (callback) callback();
          },
        } }),
      ] }),
    ]),
    createElement('button', { attrs: {
      type: 'button',
      innerHTML: '&#x1F4C5;', 
      onclick: () => {
        cp.setTime(Number(document.getElementById(id).value));
        showModal(`time-picker-${id}`);
      },
    } })
  ];
}

function removeTab(name) {
  const newState = {...obj_data};
  delete newState.tabs[name];
  updateObjData(newState);
  if (Object.keys(newState.tabs).length > 0) {
    selectTab(Object.keys(newState.tabs)[0]);
  } else {
    selectedTab = null;
  }
  document.querySelector(`#tabs [data-tab="${name}"]`).remove();
  document.querySelector(`#tabs [data-tab-btn="${name}"]`).remove();
}


function updateKeyValue(tabName, key) {
  const inputId = `tab-${tabName}-${key}`;
  const value = document.getElementById(inputId).value;
  const newState = { ...obj_data };
  if (!('tabs' in newState)) newState.tabs = {};
  if (!(tabName in newState.tabs)) newState.tabs[tabName] = {};
  newState.tabs[tabName][key] = value;
  updateObjData(newState);
}


function addKeyValuePair(tabName, key, startValue='', force=false) {
  if (!key || !tabName || !(tabName in obj_data.tabs) || (key in obj_data.tabs[tabName] && !force)) return;
  const inputId = `tab-${tabName}-${key}`;
  document.querySelector(`#tabs [data-tab="${tabName}"] .keyPairs`).appendChild(
    createElement('div', { children: [
      createElement('label', { attrs: { innerText: key, for: inputId } }),
      createElement('input', { attrs: { id: inputId, name: inputId, value: startValue, oninput: () => updateKeyValue(tabName, key) } }),
    ] })
  );
}


async function resetTabs(toSelect=null) {
  document.querySelector(`#tabs .tabs-buttons`).innerHTML = '';
  document.querySelector(`#tabs .tabs-content`).innerHTML = '';
  let firstTab = null;
  for (const type of ['lineage', 'location', 'timeline', 'gallery']) {
    if (type in obj_data) {
      await addTab(type, obj_data[type].title, true);
    }
  }
  if ('tabs' in obj_data) {
    for (const name in obj_data.tabs) {
      if (!firstTab) firstTab = name;
      await addTab('custom', name, true);
      for (const key in obj_data.tabs[name]) {
        addKeyValuePair(name, key, obj_data.tabs[name][key], true);
      }
    }
  }
  selectedTab = null;
  if (firstTab || toSelect) selectTab(toSelect ?? firstTab);
}
