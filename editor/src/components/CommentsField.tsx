import type { CommentsResponse } from '../../../src/api/models/discussion';
import type { User } from '../../../src/api/models/user';
import { useFetch } from '../hooks/useFetch';
import CommentCard from './CommentCard';

export type CommentsFieldProps = {
  apiRoute: string,
  universeShortname: string,
  commentAction: string,
  canComment: boolean,
  canDelete: boolean,
};

export default function CommentsField({ apiRoute, universeShortname, commentAction, canComment, canDelete }: CommentsFieldProps) {
  const meFetch = useFetch<User>('/api/me');
  const commentsFetch = useFetch<CommentsResponse>(apiRoute);

  if (!commentsFetch.data || !meFetch.data) {
    return <div className='d-flex justify-center align-center'>
      <div className='loader' style={{ marginTop: 'max(0px, calc(50vh - 50px - var(--page-margin-top)))' }}></div>
    </div>;
  }

  const { authors, comments } = commentsFetch.data;

  console.log(authors, comments)
  return <>
    {comments.map((comment) => {
      const author = comment.author_id ? authors[comment.author_id] : null;
      const doDelete = () => {};
      return <CommentCard comment={comment} author={author} me={null} canDelete={canDelete} doDelete={doDelete} />;
    })}
  </>;
}
