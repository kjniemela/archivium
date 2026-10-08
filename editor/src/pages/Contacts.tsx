import { useEffect, useState } from 'react';
import { fetchAsync, fetchData, T } from '../helpers';
import type { ContactUser } from '../../../src/api/models/contact';
import type { User } from '../../../src/api/models/user';
import ContactCard from '../components/ContactCard';

function contactsList(
  contacts: ContactUser[] | null,
  deleteContact: (usr: string) => Promise<void>,
  respond: (usr: string, acc: boolean) => Promise<void>,
) {
  if (!contacts) {
    return (
      <div className='d-flex justify-center align-center'>
        <div className='loader' style={{ marginTop: 'max(0px, calc(50vh - 50px - var(--page-margin-top)))' }}></div>
      </div>
    );
  } else {
    const accepted = contacts.filter((contact) => contact.accepted);
    const pending = contacts.filter((contact) => !contact.accepted);
    return <>
      <h2>{T('All (%s)', accepted.length.toString())}</h2>
      <div id='contacts-list' className='d-flex flex-col gap-2'>
        {accepted.map((contact) => <ContactCard key={contact.id} contact={contact} remove={deleteContact} respond={respond} />)}
      </div>
      {pending.length > 0 && (
        <>
          <h2>{T('Pending (%s)', pending.length.toString())}</h2>
          <div className='d-flex flex-col gap-2'>
            {pending.map((contact) => <ContactCard key={contact.id} contact={contact} remove={deleteContact} respond={respond} />)}
          </div>
        </>
      )}
    </>;
  }
}

export default function Contacts() {
  const [, setSelf] = useState<User | null>(null);
  const [contacts, setContacts] = useState<ContactUser[] | null>(null);

  async function refetchContacts() {
    const contactsData = await fetchAsync(`/api/contacts`) as ContactUser[];
    setContacts(contactsData);
  }

  useEffect(() => {
    fetchData(`/api/me`, async (user: User) => setSelf(user));
    refetchContacts();
  }, []);

  const [newUser, setNewUser] = useState<string>('');
  async function addContact(username: string) {
    await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    refetchContacts();
  }

  async function deleteContact(username: string) {
    await fetch('/api/contacts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    refetchContacts();
  }

  async function respond(username: string, accepted: boolean) {
    await fetch('/api/contacts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, accepted }),
    });
    refetchContacts();
  }

  return <>
    <h1 className='center'>{T('Contacts')}</h1>
    <hr />
    <div className='grid gap-2' style={{ gridTemplateColumns: '1fr 2fr' }}>
      <div className='col-1'>
        <div className='d-flex'>
          <input id='username' name='username' placeholder={T('Username')} value={newUser} onChange={(e) => setNewUser(e.target.value)} />
          <button onClick={() => addContact(newUser)}>{T('Add Contact')}</button>
        </div>
        {contactsList(contacts, deleteContact, respond)}
      </div>
      <div className='col-2'></div>
    </div>
  </>;
}
