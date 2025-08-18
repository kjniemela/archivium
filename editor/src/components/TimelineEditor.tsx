import { useState } from 'react';
import { T } from '../helpers';
import { createPortal } from 'react-dom';
import TimePicker from './TimePicker';
import type { EventItem, Item } from '../App';
import SearchableSelect from './SearchableSelect';
import { type ItemEvent } from '../../../src/api/models/item';

type TimelineProps = {
  item: Item,
  onEventsUpdate: (newEvents: ItemEvent[]) => void,
  eventItemMap: Record<number, EventItem[]>,
};

export default function TimelineEditor({ item, onEventsUpdate, eventItemMap }: TimelineProps) {
  const [timePickerModal, setTimePickerModal] = useState<number | null>(null);
  const [importEventModal, setImportEventModal] = useState<boolean>(false);
  const [newEventTitle, setNewEventTitle] = useState<string>('');
  const [newEventTime, setNewEventTime] = useState<number>(0);
  const [importItem, setImportItem] = useState<number | null>(null);
  const [importEvent, setImportEvent] = useState<string | null>(null);
  const modalAnchor = document.querySelector('#modal-anchor') as HTMLElement;

  
  const sortedEvents = (item.events ?? []).sort((a, b) => a.abstime > b.abstime ? 1 : -1);

  const handleEventTitleChange = (i: number, value: string) => {
    const newEvents = [ ...item.events ];
    newEvents[i].event_title = value;
    onEventsUpdate(newEvents);
  };

  const handleEventTimeChange = (i: number, value: number) => {
    const newEvents = [ ...item.events ];
    newEvents[i].abstime = Math.round(Number(value));
    onEventsUpdate(newEvents);
  };

  const removeEvent = (i: any) => {
    const newEvents = [ ...item.events ];
    newEvents.splice(i, 1);
    onEventsUpdate(newEvents);
  };

  const createNewEvent = () => {
    const newEvents = [ ...item.events ];
    
    if (!newEventTitle && newEvents?.some(({ event_title }) => !event_title)) {
      alert('Only one untitled event allowed per item!');
      return;
    }
    
    newEvents.push({
      event_title: newEventTitle,
      abstime: newEventTime,
      src_shortname: item.shortname,
      src_title: item.title,
      src_id: item.id,
    });
    onEventsUpdate(newEvents);
  };

  const handleImportEvent = () => {
    const newEvents = [ ...item.events ];

    if (!(importItem && importEvent)) return;

    const event = eventItemMap[importItem].find(([,,, event_title]) => event_title === importEvent);
    if (!event) return;
    const [src_shortname, src_title, src_id, event_title, abstime] = event;

    newEvents.push({
      event_title,
      abstime,
      src_shortname,
      src_title,
      src_id,
    });

    setImportEventModal(false);
    onEventsUpdate(newEvents);
  };

  const createTimePickerModal = (index: number, abstime: number) => {
    return <>
      {timePickerModal === index && (
        createPortal(
          <div className='modal' onClick={() => setTimePickerModal(null)}>
            <div className='modal-content' onClick={(e) => e.stopPropagation()}>
              <div className='sheet d-flex flex-col gap-1'>
                <TimePicker abstime={abstime} onSelect={(time) => {
                  setTimePickerModal(null);
                  if (index === -1) {
                    setNewEventTime(time);
                  } else {
                    handleEventTimeChange(index, time);
                  }
                }} />
              </div>
            </div>
          </div>,
          modalAnchor,
        )
      )}
    </>;
  };

  const importItemOptions: { [id: number]: string } = {};
  for (const id in eventItemMap) {
    const [, title] = eventItemMap[id][0];
    importItemOptions[id] = title;
  }

  return <div>
    <h4>{T('Events')}</h4>
    
    {sortedEvents.map((event: ItemEvent, i: number) => (
      <div key={i}>
        {event.src_id !== item.id ? (
          <span>
            {event.event_title ? `${event.event_title} of ` : ''}{event.src_title}: {event.event_title}
          </span>
        ) : (
          <>
            <input
              value={event.event_title}
              placeholder={T('Title')}
              onChange={(e) => handleEventTitleChange(i, e.target.value)}
            />
            <input
              id={`${i}_event_time`}
              value={event.abstime}
              placeholder={T('Time')}
              type='number'
              onChange={(e) => handleEventTimeChange(i, Number(e.target.value))}
              // onBlur={(e) => {
              //   const roundedValue = Math.round(Number(e.target.value));
              //   e.target.value = roundedValue.toString();
              //   handleEventTimeBlur(i, roundedValue);
              // }}
            />
            <button type='button' onClick={() => setTimePickerModal(i)}>&#x1F4C5;</button>
            {createTimePickerModal(i, event.abstime)}
          </>
        )}
        
        <button
          type="button"
          onClick={() => removeEvent(i)}
        >
          {T('Remove')}
        </button>
      </div>
    ))}
    
    <br />
    
    <h4>{T('Add Events')}</h4>
    <div className="d-flex flex-col gap-1 pa-1 align-start">
      <div>
        <b>{T('Title')}: </b>
        <input id='new_event_title' value={newEventTitle} onChange={({ target }) => setNewEventTitle(target.value)} />
      </div>
      
      <div>
        <b>{T('Time')}: </b>
        <input
          id='new_event_time'
          value={newEventTime}
          onChange={({ target }) => setNewEventTime(Number(target.value))}
          type='number'
        />
        <button type='button' onClick={() => setTimePickerModal(-1)}>&#x1F4C5;</button>
        {createTimePickerModal(-1, 0)}
      </div>
      
      <button
        type="button"
        onClick={createNewEvent}
      >
        {T('Create New Event')}
      </button>
    </div>
    
    <br />
    
    <div>
      <button type='button' onClick={() => setImportEventModal(true)}>{T('Import Event')}</button>
      {importEventModal && (
        createPortal(
          <div className='modal' onClick={() => setImportEventModal(false)}>
            <div className='modal-content' onClick={(e) => e.stopPropagation()}>
              <div className='sheet d-flex flex-col gap-1'>
                <SearchableSelect options={importItemOptions} onSelect={(id) => setImportItem(Number(id))} />
                {importItem && <SearchableSelect options={eventItemMap[importItem].reduce((acc, [,,, eventTitle]) => ({ ...acc, [eventTitle]: eventTitle }), {})} onSelect={(eventTitle) => setImportEvent(eventTitle)} />}
                <button type='button' onClick={handleImportEvent}>{T('Import')}</button>
              </div>
            </div>
          </div>,
          modalAnchor,
        )
      )}
    </div>
  </div>;
}