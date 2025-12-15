import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { T } from '../helpers';
import type React from 'react';

type GalleryImageProps = {
  id: number,
  src: string,
  label: string,
  onRemoveImage: (id: number) => void,
  onChangeLabel: (id: number, label: string) => void,
  isDragging?: boolean,
};

export default function GalleryImageCard({ id, src, label, onRemoveImage, onChangeLabel, isDragging }: GalleryImageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    padding: '8px 12px',
    marginBottom: '8px',
    border: '1px solid var(--input-border-color)',
    borderRadius: '8px',
    backgroundColor: 'var(--sheet-color)',
    height: '24rem',
    width: '16rem',
    boxShadow: isDragging ? '0 0.5rem 1rem 0 rgb(0 0 0 / 30%)' : '0 0.25rem 0.5rem 0 rgb(0 0 0 / 20%)',
    touchAction: 'none',
  };

  return (
    <div key={id} ref={setNodeRef} style={style}>
      <div className='d-flex flex-col gap-2 justify-between h-100'>
        <img src={src} alt={label} {...listeners} {...attributes} />
        <div className='d-flex flex-col'>
          <button type='button' onClick={() => onRemoveImage(id)}>{T('Remove Image')}</button>
          <input value={label ?? ''} placeholder='Label' onChange={({ target }) => onChangeLabel(id, target.value)} />
          <a className='link link-animated align-self-start' href={`${src}?download=1`}>{T('Download')}</a>
          <div
            className='mt-1 d-flex align-center justify-center clickable'
            style={{ height: '2rem', backgroundColor: 'var(--page-color)', borderRadius: '0.325rem', touchAction: 'none' }}
            {...listeners}
            {...attributes}
          >
            <span className='material-symbols-outlined'>menu</span>
          </div>
        </div>
      </div>
    </div>
  );
}
