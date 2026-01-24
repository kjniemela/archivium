import type { ChangeEventHandler } from 'react';
import { handleFormBlur } from '../helpers';
import type { DocUser } from '../hooks/useProvider';

export type FormSwitchProps = {
  id: string,
  title: string,
  checked: boolean,
  onChange: ChangeEventHandler<HTMLInputElement>,
  setAwareness: (data: Partial<DocUser>) => void,
  selections: { [el: string]: DocUser },
};

export const FormSwitch = ({ id, title, checked, onChange, setAwareness, selections }: FormSwitchProps) => (
  <div className='inputGroup'>
    <label htmlFor={id}>{title}:</label>
    <label className='switch'>
      <input
        id={id}
        name={id}
        type='checkbox'
        checked={checked}
        onChange={onChange}
        data-selection-controlled={id}
      onFocus={() => setAwareness({ selectedElement: id })}
        onBlur={({ relatedTarget }) => handleFormBlur(relatedTarget as HTMLElement, () => setAwareness({ selectedElement: null }))}
      />
      <span
        className='slider'
        style={selections[id] ? { backgroundColor: selections[id].color ?? '' } : undefined}
      />
    </label>
  </div>
);
