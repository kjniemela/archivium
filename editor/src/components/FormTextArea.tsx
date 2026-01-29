import type { ChangeEventHandler } from 'react';
import { handleFormBlur } from '../helpers';
import type { DocSelection, DocUser } from '../hooks/useProvider';

export type FormTextAreaProps = {
  id: string,
  title: string,
  value: string,
  onChange: ChangeEventHandler<HTMLTextAreaElement>,
  setAwareness: (data: Partial<DocSelection>) => void,
  selectors: { [el: string]: DocUser },
};

export const FormTextArea = ({ id, title, value, onChange, setAwareness, selectors }: FormTextAreaProps) => (
  <div className='inputGroup'>
    <label htmlFor={id}>{title}:</label>
    <textarea
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
    />
  </div>
);
