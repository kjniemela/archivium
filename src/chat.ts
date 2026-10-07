import WebSocket from "ws";
import { User } from "./api/models/user";
import { AssertionError } from "./errors";

type SocketMsg = { action?: string };
type SocketResponse = { onlineUsers?: string[] };

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

const connectedUsernames: { [id: number]: string } = {};
const userConnections: { [id: number]: WebSocket[] } = {};

function refreshOnlineListForAll() {
    for (const userId in userConnections) {
        const connetions = userConnections[userId];
        const myUsername = connectedUsernames[userId];
        const otherConnectedUsernames = Object.values(connectedUsernames).filter(username => username !== myUsername);
        for (const conn of connetions) {
            if (!conn) continue;
            sendJSON(conn, { onlineUsers: otherConnectedUsernames });
        }
    }
}

export function handleMessage(data: unknown, ws: WebSocket, user: User) {
    validateMessage(data);
    if (data.action === 'connect') {
        connectedUsernames[user.id] = user.username;
        if (!(user.id in userConnections)) userConnections[user.id] = [];
        const index = userConnections[user.id].push(ws) - 1;
        ws.on('close', () => {
            delete userConnections[user.id][index];
            if (userConnections[user.id].filter(row => row !== undefined).length === 0) {
                delete connectedUsernames[user.id];
                delete userConnections[user.id];
            }
            refreshOnlineListForAll();
        });

        refreshOnlineListForAll();
    }
}
