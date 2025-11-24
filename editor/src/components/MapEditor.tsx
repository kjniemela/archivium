import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, useDraggable, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useRef, useState } from 'react';
import type { Item, Map, MapLocation } from '../../../src/api/models/item';
import { T } from '../helpers';
import type { Categories, ItemOptionEntry } from '../pages/ItemEdit';

type MapEditorProps = {
  item: Item,
  categories: Categories,
  onUpdate: (newItem: Item) => void,
  itemMap: Record<string, ItemOptionEntry>,
};

const remSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);

export default function MapEditor({ item, categories, onUpdate, itemMap }: MapEditorProps) {
  const [uploadModal, setUploadModal] = useState<boolean>(false);
  const [uploadModalError, setUploadModalError] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const modalAnchor = document.querySelector('#modal-anchor') as HTMLElement;

  const [mapContainerSize, setMapContainerSize] = useState<number>(window.outerHeight);
  const [mapContainerMaxHeight, setMapContainerMaxHeight] = useState<number>(window.innerHeight * 0.8);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleResize = () => {
      console.log(mapContainerRef.current?.offsetWidth)
      const maxHeight = window.innerHeight - (remSize * 16);
      const containerSize = Math.min((mapContainerRef.current?.clientWidth ?? remSize), maxHeight);
      setMapContainerSize(containerSize - remSize);
      setMapContainerMaxHeight(maxHeight);
    };
    handleResize();

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  const mouseSensor = useSensor(MouseSensor);
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 150,
      tolerance: 5,
    },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {});
  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

  const prepNewItem = (): Item & { map: Map } => {
    return {
      ...item,
      map: item.map ?? {
        id: null,
        width: null,
        height: null,
        image_id: null,
        locations: [],
      },
    };
  }
  const addLocation = (location: MapLocation): void => {
    const newItem = prepNewItem();
    newItem.map.locations.push(location);
    onUpdate(newItem);
  };
  const modifyLocation = (index: number, fn: (location: MapLocation) => void): void => {
    const newItem = prepNewItem();
    const location = newItem.map.locations[index];
    if (!location) return;
    fn(location);
    onUpdate(newItem);
  };

  return <>
    <div ref={mapContainerRef} className='scroll-x' style={{ maxHeight: `${mapContainerMaxHeight}px` }}>
      <div
        className='map-container pa-2'
        style={{ width: `${mapContainerSize}px`, height: `${mapContainerSize}px` }}
        onClick={(e) => {
          const rect = (e.target as HTMLElement).getBoundingClientRect();
          const x = Math.max(0, Math.min((e.clientX - rect.left - (remSize / 2)) / mapContainerSize, 1));
          const y = Math.max(0, Math.min((e.clientY - rect.top - (remSize / 2)) / mapContainerSize, 1));
          addLocation({
            id: null,
            title: null,
            universe: null,
            item: null,
            x, y,
          });
        }}
      >
        <DndContext
          sensors={sensors}
          onDragEnd={(e) => {
            const { active, delta } = e;
            modifyLocation(Number(active.id), (location) => {
              location.x = Math.max(0, Math.min(location.x + (delta.x / mapContainerSize), 1));
              location.y = Math.max(0, Math.min(location.y + (delta.y / mapContainerSize), 1));
            });
          }}
        >
          {item.map?.locations.map((location, i) => (
            <MapLocation
              index={i}
              label={
                location.title || (
                  location.item && location.universe === item.universe_short && itemMap[location.item].title
                ) || 'Untitled Location'
              }
              x={location.x}
              y={location.y}
              scale={mapContainerSize}
            />
          ))}
        </DndContext>
      </div>
    </div>
    <button type='button' onClick={() => setUploadModal(true)}>{T('Upload Image')}</button>
    {/* {uploadModal && (
      createPortal(
        <div className='modal' onClick={() => setUploadModal(false)}>
          <div className='modal-content' onClick={(e) => e.stopPropagation()}>
            <div className='sheet d-flex flex-col gap-1 align-center'>
              <h2>{T('Upload Image')}</h2>
              <input type='file' accept='image/*' required multiple></input>
              {uploadModalError && <div>
                <span id='item-error' className='color-error' style={{ fontSize: 'small' }}>{uploadModalError}</span>
              </div>}
              {uploading && <div className='d-flex justify-center align-center'>
                <div className='loader ma-2'></div>
              </div>}
              <button type='button' onClick={async ({ target }) => {
                const imageInput = (target as HTMLElement).parentElement?.querySelector('input[type=file]') as HTMLInputElement;
                if (!imageInput.files) return;

                setUploading(true);

                const uploadedImages = [];
                for (const image of imageInput.files) {
                  const response = await postFormData(`/api/universes/${universe}/items/${item}/gallery/upload`, { image });
                  const data = await response.json();
  
                  if (response.status === HttpStatusCode.InsufficientStorage) {
                    setUploadModalError('There is not enough available storage to upload this image!');
                    setUploading(false);
                    return;
                  }
                  
                  uploadedImages.push({
                    id: data.insertId,
                    name: image.name,
                    label: '',
                  });
                }

                onUploadImages(uploadedImages);
                setUploadModal(false);
                setUploading(false);
              }}>{T('Upload')}</button>
            </div>
          </div>
        </div>,
        modalAnchor
      )
    )} */}
  </>;
}

interface MapLocationProps {
  index: number;
  label: string;
  x: number;
  y: number;
  scale: number;
}

function MapLocation({
  index,
  label,
  x,
  y,
  scale,
}: MapLocationProps) {
  const { attributes, isDragging, listeners, setNodeRef, transform } = useDraggable({
    id: index,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    position: 'absolute',
    border: '0.5rem solid black',
    borderRadius: '0.5rem',
    padding: 0,
    top: (y * scale),
    left: (x * scale),
  }

  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className='map-location'
      style={style}
    >
      <label>{label} ({x.toFixed(2)} / {y.toFixed(2)})</label>
    </button>
  );
}
