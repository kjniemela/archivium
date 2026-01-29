import type { ChangeEventHandler } from 'react';
import { handleFormBlur, T } from '../helpers';
import type { DocSelection, DocUser } from '../hooks/useProvider';

export type FormSelectProps = {
  id: string,
  title: string,
  value: string,
  options: { [key: string]: string },
  onChange: ChangeEventHandler<HTMLSelectElement>,
  setAwareness: (data: Partial<DocSelection>) => void,
  selectors: { [el: string]: DocUser },
};

export const FormSelect = ({ id, title, value, options, onChange, setAwareness, selectors }: FormSelectProps) => (
  <div className='inputGroup'>
    <label htmlFor={id}>{title}:</label>
    <select
      id={id}
      name={id}
      value={value}
      onChange={onChange}
      data-selection-controlled={id}
      onFocus={() => setAwareness({ selectedElement: id })}
      onBlur={({ relatedTarget }) => handleFormBlur(relatedTarget as HTMLElement, setAwareness)}
      style={selectors[id] ? {
        border: `0.1875rem solid ${selectors[id].color}`,
        margin: 'calc(-0.1875rem + 0.0625rem)',
      } : undefined}
    >
      <option hidden disabled>{T('Select one')}...</option>
      {Object.keys(options).map(key => (
        <option key={key} value={key}>
          {options[key]}
        </option>
      ))}
    </select>
  </div>
);
