import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Aside } from '../extensions/Aside';

export default function RichEditor({ content }: { content?: string }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
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
