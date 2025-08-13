import { EditorContent, Editor } from '@tiptap/react';

type RichEditorProps = {
  editor: Editor;
};

export default function EditorFrame({ editor }: RichEditorProps) {
  return <div className='markdown'>
    <EditorContent editor={editor} />
  </div>;
}
