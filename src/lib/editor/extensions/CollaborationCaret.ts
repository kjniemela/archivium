import CollaborationCaretBase from '@tiptap/extension-collaboration-caret';
import { Plugin, PluginKey, Selection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { CellSelection } from '@tiptap/pm/tables';
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
  yCursorPlugin,
  ySyncPluginKey,
} from '@tiptap/y-tiptap';
import * as Y from 'yjs';

const CELL_SELECTION_FIELD = 'cellSelection';
const cellSelectionKey = new PluginKey('remoteCellSelections');

/**
 * Shares table cell selections with other users and draws them in each user's color.
 * The stock cursor plugin only knows about text ranges, so for a cell selection we make it
 * send a plain caret inside the head cell, and publish the cell rectangle separately.
 */
function cellSelectionPlugin(awareness: any, selectionColor: (color: string) => string) {
  return new Plugin({
    key: cellSelectionKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, decorations, _oldState, newState) {
        if (!tr.getMeta(cellSelectionKey) && !tr.docChanged) return decorations.map(tr.mapping, tr.doc);

        const ystate = ySyncPluginKey.getState(newState as any);
        if (!ystate?.doc || !ystate.binding || ystate.binding.mapping.size === 0) return DecorationSet.empty;

        const result: Decoration[] = [];
        awareness.getStates().forEach((aw: any, clientId: number) => {
          const sel = aw[CELL_SELECTION_FIELD];
          if (clientId === ystate.doc.clientID || !sel) return;
          try {
            const anchor = relativePositionToAbsolutePosition(
              ystate.doc, ystate.type, Y.createRelativePositionFromJSON(sel.anchor), ystate.binding.mapping,
            );
            const head = relativePositionToAbsolutePosition(
              ystate.doc, ystate.type, Y.createRelativePositionFromJSON(sel.head), ystate.binding.mapping,
            );
            if (anchor === null || head === null) return;
            const $anchor = newState.doc.resolve(anchor);
            const $head = newState.doc.resolve(head);
            if (!$anchor.nodeAfter || !$head.nodeAfter) return;
            const cellSel = new CellSelection($anchor, $head);
            const color = selectionColor(aw.user?.color ?? '#ffa500');
            cellSel.forEachCell((node, pos) => {
              result.push(Decoration.node(pos, pos + node.nodeSize, {
                class: 'collaboration-carets__cell',
                style: `background-color: ${color}`,
              }));
            });
          } catch {
            // The positions are transiently invalid while the documents are syncing, so skip this user
          }
        });
        return DecorationSet.create(newState.doc, result);
      },
    },
    props: {
      decorations: state => cellSelectionKey.getState(state),
    },
    view: (view) => {
      const refresh = () => {
        if ((view as any).docView) view.dispatch(view.state.tr.setMeta(cellSelectionKey, true));
      };
      const publish = () => {
        const sel = view.state.selection;
        const ystate = ySyncPluginKey.getState(view.state as any);
        const current = awareness.getLocalState()?.[CELL_SELECTION_FIELD] ?? null;
        if (view.hasFocus() && sel instanceof CellSelection && ystate?.binding) {
          const anchor = absolutePositionToRelativePosition(sel.$anchorCell.pos, ystate.type, ystate.binding.mapping);
          const head = absolutePositionToRelativePosition(sel.$headCell.pos, ystate.type, ystate.binding.mapping);
          if (
            !current
            || !Y.compareRelativePositions(Y.createRelativePositionFromJSON(current.anchor), anchor)
            || !Y.compareRelativePositions(Y.createRelativePositionFromJSON(current.head), head)
          ) {
            awareness.setLocalStateField(CELL_SELECTION_FIELD, { anchor, head });
          }
        } else if (current) {
          awareness.setLocalStateField(CELL_SELECTION_FIELD, null);
        }
      };
      awareness.on('change', refresh);
      view.dom.addEventListener('focusout', publish);
      return {
        update: publish,
        destroy: () => {
          awareness.off('change', refresh);
          view.dom.removeEventListener('focusout', publish);
          awareness.setLocalStateField(CELL_SELECTION_FIELD, null);
        },
      };
    },
  });
}

const CollaborationCaret = CollaborationCaretBase.extend({
  addProseMirrorPlugins() {
    const { awareness } = this.options.provider;
    awareness.setLocalStateField('user', this.options.user);
    this.storage.users = Array.from(awareness.states.entries()).map(([clientId, value]: [number, any]) => ({ clientId, ...value.user }));
    awareness.on('update', () => {
      this.storage.users = Array.from(awareness.states.entries()).map(([clientId, value]: [number, any]) => ({ clientId, ...value.user }));
    });

    return [
      yCursorPlugin(awareness, {
        cursorBuilder: this.options.render,
        selectionBuilder: this.options.selectionRender,
        // A cell selection spans a rectangle, which the text range selection can't represent, so only send a caret
        getSelection: (state) => {
          const sel = state.selection;
          if (sel instanceof CellSelection) {
            const near = Selection.near(state.doc.resolve(sel.$headCell.pos + 1));
            return { anchor: near.head, head: near.head } as Selection;
          }
          return sel;
        },
      }),
      cellSelectionPlugin(awareness, color => `${color}70`),
    ];
  },
});

export default CollaborationCaret;
