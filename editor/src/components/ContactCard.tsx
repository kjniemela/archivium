import type { ContactListEntry } from '../../../src/api/models/contact';
import { plans } from '../../../src/lib/plans';
import { T } from '../helpers';

type ContactCardProps = {
  contact: ContactListEntry,
  online: boolean,
  remove: (usr: string) => Promise<void>,
  respond: (usr: string, acc: boolean) => Promise<void>,
};

export default function ContactCard({ contact, online, remove, respond }: ContactCardProps) {
  return (
    <div className='contact-card sheet d-flex gap-4 align-start pa-2 badge-anchor' data-user={contact.username}>
      <div style={{ fontSize: '0.75rem' }}>
        <div className='badge-anchor mb-auto'>
          <img className='userIcon' alt={contact.username} src={contact.pfpUrl} />
          <div
            className={`badge online-badge badge-success${online ? '' : ' hidden'}`}
            style={{ top: 'unset', bottom: '0.25em', right: '0.25em', border: '0.125rem solid var(--sheet-color)' }}
          />
        </div>
      </div>
      <div className='d-flex flex-col grow-1'>
        <div className='d-flex align-baseline gap-2'>
          <h2 className='ma-0'>
            <a className='link link-animated' href={`/users/${contact.username}`}>{contact.username}</a>
          </h2>
          {(contact.plan === plans.BETA || contact.plan === plans.PREMIUM_BETA) && (
            <div className='badge user-badge pill-badge'>
              <span className='material-symbols-outlined'>experiment</span>
              <strong>{T('Beta Tester')}</strong>
            </div>
          )}
          {contact.plan === plans.SUPER && (
            <div className='badge user-badge pill-badge'>
              <span className='material-symbols-outlined'>security</span>
              <strong>{T('Site Admin')}</strong>
            </div>
          )}
        </div>
        {!contact.accepted && (
          <div className='d-flex gap-1'>
            {contact.is_request ? (
              <>
                <button onClick={() => respond(contact.username, true)}>{T('Accept')}</button>
                <button onClick={() => respond(contact.username, false)}>{T('Reject')}</button>
              </>
            ) : (
              <span>{T('Pending')}</span>
            )}
          </div>
        )}
      </div>
      {Boolean(contact.accepted) && (
        <div
          className='material-symbols-outlined badge badge-large clickable'
          style={{ top: '-0.5rem', right: '-0.5rem' }}
          onClick={() => remove(contact.username)}
        >delete</div>
      )}
    </div>
  );
}
