import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '../extensions/Image';
import Aside from '../extensions/Aside';
import { jsonToIndexed, indexedToJson, type IndexedDocument } from '../../../src/lib/tiptapHelpers';

type RichEditorProps = {
  content?: string | Object;
  onChange: (content: IndexedDocument) => void;
};

let timeoutId: NodeJS.Timeout | null = null;
function debouncedOnUpdate(editor: any, onChange: (content: IndexedDocument) => void) {
  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  timeoutId = setTimeout(() => {
    const json = editor.getJSON();
    const indexed = jsonToIndexed(json);
    onChange(indexed);
  }, 500);
}

export default function RichEditor({ content, onChange }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Aside,
    ],
    content,
    onUpdate: ({ editor }) => {
      debouncedOnUpdate(editor, onChange);
    },
  });

  return <div className='markdown'>
    <EditorContent editor={editor} />
  </div>;
}
