import WebSocket, { WebSocketServer } from 'ws';
import type { User, UserRef } from './api/models/user';
import { AssertionError } from './errors';
import { IncomingMessage } from 'http';
import logger from './logger';
import api from './api';
import type { ContactListEntry } from './api/models/contact';

type SocketMsg = { action?: string };
type SocketResponse = {
  onlineUsers?: string[],
  contacts: ContactListEntry[],
};

function assert(condition: any, msg?: string): asserts condition {
  if (!condition) {
	throw new AssertionError(msg);
  }
}

function validateMessage(data: unknown): asserts data is SocketMsg {
	assert(data !== null);
	assert(typeof data === 'object');
	assert(!('action' in data) || typeof data.action === 'string');
}

function sendJSON(ws: WebSocket, data: SocketResponse) {
	ws.send(JSON.stringify(data));
}

type Connection = { user: User, sockets: Set<WebSocket>, disconnectTimeout?: NodeJS.Timeout };
const connections = new Map<number, Connection>();
const userBySocket = new WeakMap<WebSocket, number>();

export async function refreshContactListFor(user: UserRef) {
  const contacts = await api.contact.getAll(user);
  const acceptedContacts = contacts.filter((contact) => contact.accepted);
  const onlineUsers = acceptedContacts.filter((contact) => connections.has(contact.id)).map((contact) => contact.username);
  for (const socket of connections.get(user.id)?.sockets ?? []) {
    sendJSON(socket, { onlineUsers, contacts });
  }
}

function handleMessage(data: unknown, ws: WebSocket, user: User) {
	validateMessage(data);

  if (user.id !== userBySocket.get(ws)) ws.close(); // We're not who the server thinks we are, abort

	if (data.action === 'sync') {
    refreshContactListFor(user);
  }
}

function handleClose(ws: WebSocket, user: User) {
  userBySocket.delete(ws);
  const conn = connections.get(user.id);
  if (!conn) {
    logger.error('Fatal: No such connection!');
    return;
  }

  conn.sockets.delete(ws);

  // Check if this would mean the user is no longer connected at all
  if (conn.sockets.size === 0) {
    // Wait a bit, the user might reconnect
    if (conn.disconnectTimeout) clearTimeout(conn.disconnectTimeout);
    conn.disconnectTimeout = setTimeout(async () => {
      // If no one has reconnected, declare user offline
      if (conn.sockets.size === 0) {
        connections.delete(user.id);

        const contacts = await api.contact.getAll(user, false, true);
        for (const contact of contacts) {
          refreshContactListFor(contact);
        }
      }
    }, 5000);
  }
}

async function handleConnect(ws: WebSocket, user: User) {
  userBySocket.set(ws, user.id);

  let firstConnection = false;
  if (!connections.has(user.id)) {
    connections.set(user.id, { user, sockets: new Set() });
    firstConnection = true;
  }

  const conn = connections.get(user.id);
  conn!.sockets.add(ws);

  if (firstConnection) {
    const contacts = await api.contact.getAll(user, false, true);
    for (const contact of contacts) {
      refreshContactListFor(contact);
    }
  }
  refreshContactListFor(user);
}

export default function listenSockets(wss: WebSocketServer) {
  wss.on('connection', (ws: WebSocket, _req: IncomingMessage, user: User) => {
    try {
      handleConnect(ws, user);
    } catch (err) {
      logger.error('Failed to connect socket!');
      logger.error(err);
      ws.close();
    }

    ws.on('error', logger.error);
    ws.on('message', (msg) => {
      try {
        const data = JSON.parse(msg.toString());
        handleMessage(data, ws, user);
      } catch (err) {
        logger.error('Error processing socket message:');
        logger.error(msg.toString());
        logger.error(err);
        ws.close();
      }
    });
		ws.on('close', () => handleClose(ws, user));
  });
}
