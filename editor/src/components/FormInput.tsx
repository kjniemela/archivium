import type { ChangeEventHandler } from 'react';
import { handleFormBlur } from '../helpers';
import type { DocSelection, DocUser } from '../hooks/useProvider';

export type FormInputProps = {
  id: string,
  title: string,
  value: string,
  onChange: ChangeEventHandler<HTMLInputElement>,
  setAwareness: (data: Partial<DocSelection>) => void,
  selectors: { [el: string]: DocUser },
};

export const FormInput = ({ id, title, value, onChange, setAwareness, selectors }: FormInputProps) => (
  <div className='inputGroup'>
    <label htmlFor={id}>{title}:</label>
    <input
      id={id}
      name={id}
      type='text'
      value={value}
      onChange={onChange}
      data-selection-controlled={id}
      onFocus={() => setAwareness({ selectedElement: id })}
      onBlur={({ relatedTarget }) => handleFormBlur(relatedTarget as HTMLElement, setAwareness)}
      style={selectors[id] ? {
        border: `0.1875rem solid ${selectors[id].color}`,
        margin: 'calc(-0.1875rem + 0.0625rem)',
      } : undefined}
    />
  </div>
);
