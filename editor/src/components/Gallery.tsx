import { useState } from 'react';
import { postFormData, T } from '../helpers';
import { createPortal } from 'react-dom';
import type { GalleryImage } from '../../../src/api/models/item';

type GalleryProps = {
  universe: string,
  item: string,
  images: GalleryImage[];
  onRemoveImage: (id: number) => void,
  onUploadImage: (img: GalleryImage) => void,
  onChangeLabel: (id: number, label: string) => void,
};

export default function Gallery({ universe, item, images, onRemoveImage, onUploadImage, onChangeLabel }: GalleryProps) {
  const [uploadModal, setUploadModal] = useState<boolean>(false);
  const modalAnchor = document.querySelector('#modal-anchor') as HTMLElement;

  return <div>
    <div className='item-gallery d-flex gap-4 flex-wrap'>
      {images.map((img, i) => (
        <div>
          <div className='d-flex gap-1' style={{ height: '8rem' }}>
            <img src={`/api/universes/${universe}/items/${item}/gallery/images/${img.id}`} alt={img.label} />
            <div className='d-flex flex-col'>
              <button type='button' onClick={() => onRemoveImage(img.id)}>{T('Remove Image')}</button>
              <input value={img.label ?? ''} placeholder='Label' onChange={({ target }) => onChangeLabel(img.id, target.value)} />
              <a className='link link-animated align-self-start' href={`/api/universes/${universe}/items/${item}/gallery/images/${img.id}?download=1`}>{T('Download')}</a>
            </div>
          </div>
        </div>
      ))}
    </div>
    <button type='button' onClick={() => setUploadModal(true)}>{T('Upload Image')}</button>
    {uploadModal && (
      createPortal(
        <div className='modal' onClick={() => setUploadModal(false)}>
          <div className='modal-content' onClick={(e) => e.stopPropagation()}>
            <div className='sheet d-flex flex-col gap-1 align-center'>
              <h2>{T('Upload Image')}</h2>
              <input type='file' accept='image/*' required></input>
              <button type='button' onClick={async ({ target }) => {
                const imageInput = (target as HTMLElement).parentElement?.querySelector('input[type=file]') as HTMLInputElement;
                if (!imageInput.files) return;
                const image = imageInput.files[0];
                const response = await postFormData(`/api/universes/${universe}/items/${item}/gallery/upload`, { image });
                const data = await response.json();

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
  </div>;
}
