import type { Comment, CommenterUser } from '../../../src/api/models/discussion';
import type { User } from '../../../src/api/models/user';
import { plans } from '../../../src/api/utils';
import { formatDate, T } from '../helpers';

export type CommentProps = {
  comment: Comment,
  author: CommenterUser | null,
  me: User | null,
  canDelete: boolean,
  doDelete: () => void,
};

const CommentCard = ({ comment, author, me, canDelete, doDelete }: CommentProps) => (
  <div className='sheet d-flex gap-4 align-start'>
    {author && (
      <div className='badge-anchor mb-auto'>
        <img className='userIcon' alt={author.username} src={author.pfpUrl} />
        {(author.plan === plans.BETA || author.plan === plans.PREMIUM_BETA) && (
            <div className='badge user-badge pill-badge'>
              <span className='material-symbols-outlined'>experiment</span>
              <strong>{T('Beta Tester')}</strong>
            </div>
          )}
          {author.plan === plans.SUPER && (
            <div className='badge user-badge pill-badge'>
              <span className='material-symbols-outlined'>security</span>
              <strong>{T('Site Admin')}</strong>
            </div>
          )}
      </div>
    )}
    {comment.body ? (
      <div className='d-flex flex-col grow-1 overflow-hidden'>
        <div className='d-flex align-baseline'>
          {author ? (
            <a className='link link-animated' href={`/users/${author.username}`}>
              <strong>{author.username}</strong>
            </a>
          ) : (
            <span>{T('Deleted User')}</span>
          )}
          <small className='ml-2'>{formatDate(comment.created_at)}</small>
          {me && (
            <div className='grow-1'>
              {(me.id === author?.id || canDelete) && (
                <small className='align-self-start'>
                  <a className='link link-animated d-flex align-center' onClick={() => doDelete()}>
                    <span className='material-symbols-outlined' style={{ fontSize: '1rem' }}>delete</span>
                    Delete
                  </a>
                </small>
              )}
            </div>
          )}
        </div>
        <div className='comment'>{comment.body}</div>
      </div>
    ) : (
      <span className='link disabled'>{T('Deleted comment')}</span>
    )}
  </div>
);
export default CommentCard;
