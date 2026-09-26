import type { ReactNode } from 'react';
import {
  entryListValues,
  evaluate,
  isEnabled,
  ladderRatings,
  ladderRows,
  numberValue,
  sectionFlex,
  setPath,
  textAt,
  textListValues,
  trackBoxes,
  validateLayoutData,
  type EntryListField,
  type RatingLadderField,
  type LayoutField,
  type TabLayout,
} from '../../../src/lib/tabLayout';

type LayoutTabEditorProps = {
  layout: TabLayout,
  data: unknown,
  itemTitle: string,
  onChange: (data: unknown) => void,
};

type FieldProps<F> = {
  field: F,
  id: string,
  data: unknown,
  set: (path: string, value: unknown) => void,
};

function Caption({ htmlFor, children }: { htmlFor?: string, children: ReactNode }) {
  return <label htmlFor={htmlFor} className='tab-layout-caption'>{children}</label>;
}

function EntryList({ field, id, data, set }: FieldProps<EntryListField>) {
  const entries = entryListValues(field, data);
  const setEntry = (index: number, key: string, value: string) => {
    const next = [...entries];
    next[index] = { ...next[index], [key]: value };
    set(field.path, next);
  };

  return <>
    {entries.map((entry, i) => (
      <div key={i} className='d-flex flex-col gap-1'>
        {field.fields.map(({ key, placeholder, multiline }, j) => {
          const props = {
            id: `${id}-${i}-${key}`,
            'aria-label': `${field.itemLabel} ${i + 1} ${placeholder}`,
            placeholder,
            value: typeof entry[key] === 'string' ? entry[key] : '',
          };
          const input = multiline
            ? <textarea {...props} className='tab-layout-textarea' onChange={({ target }) => setEntry(i, key, target.value)} />
            : <input {...props} className='grow-1' onChange={({ target }) => setEntry(i, key, target.value)} />;
          if (j > 0) return <div key={key} className='tab-layout-field'>{input}</div>;
          return <div key={key} className='d-flex gap-1'>
            {input}
            <button type='button' onClick={() => set(field.path, entries.filter((_, k) => k !== i))}>Remove</button>
          </div>;
        })}
      </div>
    ))}
    <div>
      <button type='button' onClick={() => set(field.path, [...entries, Object.fromEntries(field.fields.map(({ key }) => [key, '']))])}>
        {field.addLabel}
      </button>
    </div>
  </>;
}

function RatingLadder({ field, data, set }: FieldProps<RatingLadderField>) {
  const ratings = ladderRatings(field, data);
  const unassigned = field.options.filter(option => !ratings[option]);

  const replace = (oldOption: string, newOption: string, rating: number) => {
    const next = { ...ratings };
    delete next[oldOption];
    if (newOption) next[newOption] = rating;
    set(field.path, next);
  };

  return <>
    {ladderRows(field, data).map(({ value, label, entries }) => (
      <div key={value} className='tab-layout-line'>
        <span className='tab-layout-rating'>{label}</span>
        <div className='tab-layout-chips'>
          {entries.map(option => (
            <select key={option} aria-label={`${label}: ${option}`} value={option} onChange={({ target }) => replace(option, target.value, value)}>
              <option value={option}>{option}</option>
              {unassigned.map(other => <option key={other} value={other}>{other}</option>)}
              <option value=''>(remove)</option>
            </select>
          ))}
          {unassigned.length > 0 && <select
            aria-label={`Add at ${label}`}
            value=''
            onChange={({ target }) => replace('', target.value, value)}
            style={{ color: 'var(--light-text-color)' }}
          >
            <option value=''>+ Add</option>
            {unassigned.map(option => <option key={option} value={option}>{option}</option>)}
          </select>}
        </div>
      </div>
    ))}
  </>;
}

function Field({ field, id, data, set, itemTitle }: FieldProps<LayoutField> & { itemTitle: string }) {
  switch (field.widget) {
    case 'title':
      return <div className='tab-layout-field'>
        <span className='lora big-text'>{itemTitle}</span>
        {field.caption && <Caption>{field.caption}</Caption>}
      </div>;

    case 'text': {
      const props = {
        id,
        'aria-label': field.caption ? undefined : field.label,
        value: textAt(data, field.path),
      };
      return <div className='tab-layout-field'>
        {field.multiline
          ? <textarea {...props} className='tab-layout-textarea' rows={field.rows} onChange={({ target }) => set(field.path, target.value)} />
          : <input {...props} onChange={({ target }) => set(field.path, target.value)} />}
        {field.caption && <Caption htmlFor={id}>{field.caption}</Caption>}
      </div>;
    }

    case 'number':
      return <input
        id={id}
        type='number'
        aria-label={field.label}
        min={field.min}
        className='center'
        style={{ width: '4rem', fontSize: '1.5rem' }}
        value={numberValue(field, data)}
        onChange={({ target }) => set(field.path, target.value === '' ? null : Number(target.value))}
      />;

    case 'computed':
      return <span className='tab-layout-stat-value' aria-label={field.label}>{evaluate(field.value, data)}</span>;

    case 'textList': {
      const values = textListValues(field, data);
      return <>
        {values.map((value, i) => (
          <input
            key={i}
            id={`${id}-${i}`}
            aria-label={`${field.label} ${i + 1}`}
            value={value}
            onChange={({ target }) => {
              const next = [...values];
              next[i] = target.value;
              set(field.path, next);
            }}
          />
        ))}
      </>;
    }

    case 'entryList':
      return <EntryList field={field} id={id} data={data} set={set} />;

    case 'ratingLadder':
      return <RatingLadder field={field} id={id} data={data} set={set} />;

    case 'checkTrack': {
      const boxes = trackBoxes(field, data);
      return <div className='tab-layout-line'>
        <strong className='lora' style={{ minWidth: '4.5rem' }}>{field.label}</strong>
        <div className='d-flex gap-2'>
          {boxes.map((box, i) => (
            <label key={i} className={`tab-layout-box${box.enabled ? '' : ' tab-layout-locked'}`} title={box.enabled ? undefined : field.lockedHint}>
              <span className='text-small'>{i + 1}</span>
              <input
                type='checkbox'
                aria-label={`${field.label} ${i + 1}`}
                disabled={!box.enabled}
                checked={box.checked}
                onChange={({ target }) => set(field.path, boxes.map((b, j) => j === i ? target.checked : b.checked))}
              />
            </label>
          ))}
        </div>
      </div>;
    }

    case 'slot': {
      const enabled = isEnabled(field.enabled, data);
      return <div className={`tab-layout-line${enabled ? '' : ' tab-layout-locked'}`} title={enabled ? undefined : field.lockedHint}>
        <span className='tab-layout-box'><b>{field.badge}</b></span>
        <label htmlFor={id} style={{ minWidth: '5rem' }}>{field.label}</label>
        <input id={id} className='grow-1' disabled={!enabled} value={textAt(data, field.path)} onChange={({ target }) => set(field.path, target.value)} />
      </div>;
    }
  }
}

export default function LayoutTabEditor({ layout, data, itemTitle, onChange }: LayoutTabEditorProps) {
  const set = (path: string, value: unknown) => onChange(setPath(data ?? {}, path, value));
  const problems = validateLayoutData(layout, data);

  return <div className='tab-layout'>
    {problems.length > 0 && <ul className='tab-layout-problems'>
      {problems.map(problem => <li key={problem} className='color-error'>{problem}</li>)}
    </ul>}
    {layout.rows.map((row, i) => (
      <div key={i} className='tab-layout-row'>
        {row.sections.map((section, j) => (
          <section
            key={j}
            className={`tab-layout-section${section.variant === 'stat' ? ' tab-layout-stat' : ''}`}
            style={{ flex: sectionFlex(section) }}
          >
            <h2 className='tab-layout-title'>{section.title}</h2>
            <div className='tab-layout-body'>
              {section.fields.map((field, k) => (
                <Field
                  key={k}
                  field={field}
                  id={`${layout.id}-${i}-${j}-${k}`}
                  data={data}
                  set={set}
                  itemTitle={itemTitle}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    ))}
  </div>;
}
