import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent, type UniqueIdentifier } from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { HttpStatusCode } from 'axios';
import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { type GalleryImage } from '../../../src/api/models/item';
import { postFormData, T } from '../helpers';
import GalleryImageCard from './GalleryImageCard';

type GalleryProps = {
  universe: string,
  item: string,
  images: GalleryImage[];
  onRemoveImage: (id: number) => void,
  onUploadImage: (img: GalleryImage) => void,
  onChangeLabel: (id: number, label: string) => void,
  onReorderImages: (newImages: GalleryImage[]) => void,
};

export default function Gallery({ universe, item, images, onRemoveImage, onUploadImage, onChangeLabel, onReorderImages }: GalleryProps) {
  const [uploadModal, setUploadModal] = useState<boolean>(false);
  const [uploadModalError, setUploadModalError] = useState<string>('');
  const modalAnchor = document.querySelector('#modal-anchor') as HTMLElement;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
  );

  const [localImages, setLocalImages] = useState(images);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  const handleDragStart = useCallback((event: DragEndEvent) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;
      if (active.id !== over.id) {
        const oldIndex = localImages.findIndex(img => img.id === active.id);
        const newIndex = localImages.findIndex(img => img.id === over.id);
        const newOrder = arrayMove(localImages, oldIndex, newIndex);
        setLocalImages(newOrder);
        onReorderImages(newOrder);
      }
      setActiveId(null);
    },
    [onReorderImages]
  );

  const handleDragCancel = useCallback(() => setActiveId(null), []);

  return <>
    <div className='item-gallery d-flex gap-4 flex-wrap justify-center'>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={localImages.map(i => i.id)} strategy={rectSortingStrategy}>
          {localImages.map((img) => (
            <GalleryImageCard
              id={img.id}
              src={`/api/universes/${universe}/items/${item}/gallery/images/${img.id}`}
              label={img.label}
              onRemoveImage={onRemoveImage}
              onChangeLabel={onChangeLabel}
              isDragging={activeId === img.id}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
    <button type='button' onClick={() => setUploadModal(true)}>{T('Upload Image')}</button>
    {uploadModal && (
      createPortal(
        <div className='modal' onClick={() => setUploadModal(false)}>
          <div className='modal-content' onClick={(e) => e.stopPropagation()}>
            <div className='sheet d-flex flex-col gap-1 align-center'>
              <h2>{T('Upload Image')}</h2>
              <input type='file' accept='image/*' required></input>
              {uploadModalError && <div>
                <span id='item-error' className='color-error' style={{ fontSize: 'small' }}>{uploadModalError}</span>
              </div>}
              <button type='button' onClick={async ({ target }) => {
                const imageInput = (target as HTMLElement).parentElement?.querySelector('input[type=file]') as HTMLInputElement;
                if (!imageInput.files) return;
                const image = imageInput.files[0];
                const response = await postFormData(`/api/universes/${universe}/items/${item}/gallery/upload`, { image });
                const data = await response.json();

                if (response.status === HttpStatusCode.InsufficientStorage) {
                  setUploadModalError('There is not enough available storage to upload this image!');
                  return;
                }

                onUploadImage({
                  id: data.insertId,
                  name: image.name,
                  label: '',
                });

                setUploadModal(false);
              }}>{T('Upload')}</button>
            </div>
          </div>
        </div>,
        modalAnchor
      )
    )}
  </>;
}
