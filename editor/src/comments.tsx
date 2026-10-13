import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import CommentsField, { type CommentsFieldProps } from './components/CommentsField.tsx';

const root = document.querySelector<HTMLElement>('#comments-root');

if (root) {
  const { apiRoute, universeShortname, commentAction, canComment, canDelete } = root.dataset;
  const props: CommentsFieldProps = {
    apiRoute: apiRoute!,
    universeShortname: universeShortname!,
    commentAction: commentAction!,
    canComment: !!canComment,
    canDelete: !!canDelete,
  };

  createRoot(root).render(
    <StrictMode>
      <CommentsField {...props} />
    </StrictMode>,
  );
}
