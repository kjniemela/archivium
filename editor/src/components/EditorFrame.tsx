import { EditorContent, Editor, useEditorState } from '@tiptap/react';
import { T } from '../helpers';

type RichEditorProps = {
  editor: Editor;
};

function MenuBar({ editor }: { editor: Editor }) {
  // Read the current editor's state, and re-render the component when it changes
  const editorState = useEditorState({
    editor,
    selector: ctx => {
      return {
        isBold: ctx.editor.isActive('bold') ?? false,
        canBold: ctx.editor.can().chain().toggleBold().run() ?? false,
        isItalic: ctx.editor.isActive('italic') ?? false,
        canItalic: ctx.editor.can().chain().toggleItalic().run() ?? false,
        isStrike: ctx.editor.isActive('strike') ?? false,
        canStrike: ctx.editor.can().chain().toggleStrike().run() ?? false,
        isCode: ctx.editor.isActive('code') ?? false,
        canCode: ctx.editor.can().chain().toggleCode().run() ?? false,
        canClearMarks: ctx.editor.can().chain().unsetAllMarks().run() ?? false,
        isParagraph: ctx.editor.isActive('paragraph') ?? false,
        isHeading1: ctx.editor.isActive('heading', { level: 1 }) ?? false,
        isHeading2: ctx.editor.isActive('heading', { level: 2 }) ?? false,
        isHeading3: ctx.editor.isActive('heading', { level: 3 }) ?? false,
        isHeading4: ctx.editor.isActive('heading', { level: 4 }) ?? false,
        isHeading5: ctx.editor.isActive('heading', { level: 5 }) ?? false,
        isHeading6: ctx.editor.isActive('heading', { level: 6 }) ?? false,
        isBulletList: ctx.editor.isActive('bulletList') ?? false,
        isOrderedList: ctx.editor.isActive('orderedList') ?? false,
        isCodeBlock: ctx.editor.isActive('codeBlock') ?? false,
        isAside: ctx.editor.isActive('aside') ?? false,
        isBlockquote: ctx.editor.isActive('blockquote') ?? false,
        canUndo: ctx.editor.can().chain().undo().run() ?? false,
        canRedo: ctx.editor.can().chain().redo().run() ?? false,
      }
    },
  })

  return (
    <div className='tiptap-navbar'>
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editorState.canBold}
        className={`material-symbols-outlined ${editorState.isBold ? 'is-active' : ''}`}
        title={T('Bold')}
      >
        format_bold
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editorState.canItalic}
        className={`material-symbols-outlined ${editorState.isItalic ? 'is-active' : ''}`}
        title={T('Italic')}
      >
        format_italic
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editorState.canStrike}
        className={`material-symbols-outlined ${editorState.isStrike ? 'is-active' : ''}`}
        title={T('Strikethrough')}
      >
        strikethrough_s
      </button>
      <button
        onClick={() => editor.chain().focus().toggleCode().run()}
        disabled={!editorState.canCode}
        className={`material-symbols-outlined ${editorState.isCode ? 'is-active' : ''}`}
        title={T('Code')}
      >
        code
      </button>
      <button
        onClick={() => editor.chain().focus().unsetAllMarks().run()}
        className='material-symbols-outlined'
        title='Clear Formatting'
      >
        format_clear
      </button>
      {/* <button onClick={() => editor.chain().focus().clearNodes().run()}>Clear nodes</button> */}
      {/* <button
        onClick={() => editor.chain().focus().setParagraph().run()}
        className={`material-symbols-outlined ${editorState.isParagraph ? 'is-active' : ''}`}
      >
        format_paragraph
      </button> */}
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={`material-symbols-outlined ${editorState.isHeading1 ? 'is-active' : ''}`}
        title={T('Heading 1')}
      >
        format_h1
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`material-symbols-outlined ${editorState.isHeading2 ? 'is-active' : ''}`}
        title={T('Heading 2')}
      >
        format_h2
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={`material-symbols-outlined ${editorState.isHeading3 ? 'is-active' : ''}`}
        title={T('Heading 3')}
      >
        format_h3
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
        className={`material-symbols-outlined ${editorState.isHeading4 ? 'is-active' : ''}`}
        title={T('Heading 4')}
      >
        format_h4
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
        className={`material-symbols-outlined ${editorState.isHeading5 ? 'is-active' : ''}`}
        title={T('Heading 5')}
      >
        format_h5
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()}
        className={`material-symbols-outlined ${editorState.isHeading6 ? 'is-active' : ''}`}
        title={T('Heading 6')}
      >
        format_h6
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`material-symbols-outlined ${editorState.isBulletList ? 'is-active' : ''}`}
        title={T('Bullet List')}
      >
        format_list_bulleted
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`material-symbols-outlined ${editorState.isOrderedList ? 'is-active' : ''}`}
        title={T('Numbered List')}
      >
        format_list_numbered
      </button>
      <button
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={`material-symbols-outlined ${editorState.isCodeBlock ? 'is-active' : ''}`}
        title={T('Code Block')}
      >
        code_blocks
      </button>
      <button
        onClick={() => editor.chain().focus().toggleAside().run()}
        className={`material-symbols-outlined ${editorState.isAside ? 'is-active' : ''}`}
        title={T('Aside')}
      >
        view_sidebar
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={`material-symbols-outlined ${editorState.isBlockquote ? 'is-active' : ''}`}
        title={T('Blockquote')}
      >
        format_quote
      </button>
      <button
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className='material-symbols-outlined'
        title={T('Horizontal Rule')}
      >
        horizontal_rule
      </button>
      {/* <button onClick={() => editor.chain().focus().setHardBreak().run()}>Hard break</button> */}
      <button
        onClick={() => editor.chain().focus().undo().run()} 
        disabled={!editorState.canUndo}
        className='material-symbols-outlined'
        title={T('Undo')}
      >
        undo
      </button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editorState.canRedo}
        className='material-symbols-outlined'
        title={T('Redo')}
      >
        redo
      </button>
    </div>
  )
}

export default function EditorFrame({ editor }: RichEditorProps) {
  return <div className='markdown'>
    <MenuBar editor={editor} />
    <EditorContent editor={editor} />
  </div>;
}
