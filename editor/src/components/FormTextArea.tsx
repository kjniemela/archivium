import type { ChangeEventHandler } from 'react';
import { handleFormBlur } from '../helpers';
import type { DocUser } from '../hooks/useProvider';

export type FormTextAreaProps = {
  id: string,
  title: string,
  value: string,
  onChange: ChangeEventHandler<HTMLTextAreaElement>,
  setAwareness: (data: Partial<DocUser>) => void,
  selections: { [el: string]: DocUser },
};

export const FormTextArea = ({ id, title, value, onChange, setAwareness, selections }: FormTextAreaProps) => (
  <div className='inputGroup'>
    <label htmlFor={id}>{title}:</label>
    <textarea
      id={id}
      name={id}
      value={value}
      onChange={onChange}
      data-selection-controlled={id}
      onFocus={() => setAwareness({ selectedElement: id })}
      onBlur={({ relatedTarget }) => handleFormBlur(relatedTarget as HTMLElement, () => setAwareness({ selectedElement: null }))}
      style={selections[id] ? {
        border: `0.1875rem solid ${selections[id].color}`,
        margin: 'calc(-0.1875rem + 0.0625rem)',
      } : undefined}
    />
  </div>
);
