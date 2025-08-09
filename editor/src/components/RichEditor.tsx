import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '../extensions/Image';
import Aside from '../extensions/Aside';
import { jsonToIndexed } from '../../../src/lib/tiptapHelpers';

export default function RichEditor({ content }: { content?: string }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Aside,
    ],
    content,
    onUpdate: ({ editor }) => {
      console.log(editor.getJSON());
    },
  });

  return <div className='markdown'>
    <EditorContent editor={editor} />
  </div>;
}
