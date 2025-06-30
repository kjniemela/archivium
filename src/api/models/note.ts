import { API } from "..";
import crypto from 'crypto';
import { executeQuery, parseData, perms, Result } from '../utils';
import logger from '../../logger';
import { User } from "./user";

export type NoteItem = [string, string, string, string];
export type NoteBoard = [string, string, string, string];

type Board = {
  id: number,
  title: string,
  shortname: string,
  public: boolean,
  universe_id: number,
};

export type Note = {
  id: number,
  uuid: string,
  title: string,
  body: string,
  public: boolean
  author_id: number,
  created_at: Date,
  updated_at: Date,
  items?: NoteItem[],
  boards?: NoteBoard[],
};

export class NoteAPI {
  readonly api: API;

  constructor(api: API) {
    this.api = api;
  }

  async getOne(user, uuid): Result<Note> {
    // Direct note access is only allowed for our own notes.
    if (!user) return [401];

    try {
      const [code, notes] = await this.getMany(user, { 'note.uuid': uuid }, { limit: 1, fullBody: true, connections: true });
      if (!notes) return [code];
      const note = notes[0];
      if (!note) return [404];
      if (note.author_id !== user.id) return [403];
      return [200, note];
    } catch (err) {
      logger.error(err);
      return [500];
    }
  }

  /**
   * This should never be called on its own.
   * Users should have access to notes iff:
   * * they own the note,
   * * they have access to a board this note is pinned to, or,
   * * they have access to an item this note is linked to.
   * @param {*} user 
   * @param {*} conditions 
   * @param {*} options 
   * @returns 
   */
  async getMany(user, conditions, options): Result<Note[]> {
    try {
      const parsedConds = parseData(conditions ?? {});
      if (user) {
        parsedConds.strings.push('(note.public OR note.author_id = ?)');
        parsedConds.values.push(user.id);
      } else {
        parsedConds.strings.push('note.public');
      }
      if (options?.search) {
        parsedConds.strings.push('(note.title LIKE ? OR note.body LIKE ? OR tag.tags LIKE ?)');
        parsedConds.values.push(`%${options?.search}%`);
        parsedConds.values.push(`%${options?.search}%`);
        parsedConds.values.push(`%${options?.search}%`);
        parsedConds.values.unshift(`%${options?.search}%`);
        parsedConds.values.unshift(`%${options?.search}%`);
      }
      const queryString = `
        SELECT DISTINCT
          note.id, note.uuid, note.title,
          note.public, note.author_id,
          note.created_at, note.updated_at,
          tag.tags,
          ${options?.fullBody ? 'note.body' : 'SUBSTRING(note.body, 1, 255) AS body'}
          ${options?.connections ? ', item.items' : ''}
          ${options?.connections ? ', board.boards' : ''}
          ${options?.search ? ', LOCATE(?, note.body) AS match_pos' : ''}
          ${options?.search ? ', SUBSTRING(note.body,  GREATEST(1, LOCATE(?, note.body) - 50), 100) AS snippet' : ''}
        FROM note
          ${options?.connections ? `LEFT JOIN (
            SELECT itemnote.note_id, JSON_ARRAYAGG(JSON_ARRAY(item.title, item.shortname, iu.title, iu.shortname)) as items
            FROM itemnote
            INNER JOIN item ON itemnote.item_id = item.id
            INNER JOIN universe AS iu ON iu.id = item.universe_id
            GROUP BY itemnote.note_id
          ) as item ON item.note_id = note.id` : ''}
          ${options?.connections ? `LEFT JOIN (
            SELECT boardnote.note_id, JSON_ARRAYAGG(JSON_ARRAY(noteboard.title, noteboard.shortname, nu.title, nu.shortname)) as boards
            FROM boardnote
            INNER JOIN noteboard ON boardnote.board_id = noteboard.id
            INNER JOIN universe AS nu ON nu.id = noteboard.universe_id
            GROUP BY boardnote.note_id
          ) as board ON board.note_id = note.id` : ''}
          LEFT JOIN itemnote ON itemnote.note_id = note.id
          LEFT JOIN boardnote ON boardnote.note_id = note.id
          LEFT JOIN (
            SELECT note_id, JSON_ARRAYAGG(tag) as tags
            FROM notetag
            GROUP BY note_id
          ) tag ON tag.note_id = note.id
          ${options?.join ?? ''}
        WHERE ${parsedConds.strings.join(' AND ')}
        ${options?.connections ? 'GROUP BY note.id' : ''}
        ${options?.limit ? `LIMIT ${options.limit}` : ''}
      `;
      const notes = await executeQuery(queryString, parsedConds.values) as Note[];
      if (options?.limit === 1 && options?.connections && notes[0]) {
        notes[0].items = (notes[0].items ?? []).filter(val => val[0] !== null);
        notes[0].boards = (notes[0].boards ?? []).filter(val => val[0] !== null);
      }
      return [200, notes];
    } catch (err) {
      logger.error(err);
      return [500];
    }
  }

  async getByUsername(sessionUser, username, conditions, options) {
    try {
      const [code, user] = await this.api.user.getOne({ 'user.username': username });
      if (!user) return [code];
      const [_, notes] = await this.getMany(
        sessionUser,
        { ...(conditions ?? {}), 'note.author_id': user.id },
        options ?? {},
      );
      return [200, notes];
    } catch (err) {
      logger.error(err);
      return [500];
    }
  }

  async getByItemShortname(user: User, universeShortname, itemShortname, conditions, options, inclAuthors=false) {
    try {
      const [code, item] = await this.api.item.getByUniverseAndItemShortnames(user, universeShortname, itemShortname, perms.READ, true);
      if (!item) return [code];
      const [_, notes] = await this.getMany(
        user,
        { ...conditions ?? {}, 'itemnote.item_id': item?.id },
        { ...options ?? {} },
      );
      if (inclAuthors) {
        const queryString2 = `
          SELECT user.id, user.username, user.email
          FROM user
          INNER JOIN note ON user.id = note.author_id
          INNER JOIN itemnote ON itemnote.note_id = note.id
          WHERE itemnote.item_id = ?
          GROUP BY user.id`;
        const users = await executeQuery(queryString2, [ item.id ]);
        return [200, notes, users];
      }
      return [200, notes];
    } catch (err) {
      logger.error(err);
      return [500];
    }
  }

  async getBoardsByUniverseShortname(user: User, shortname) {
    try {
      const [code, universe] = await this.api.universe.getOne(user, { 'universe.shortname': shortname }, perms.READ);
      if (!universe) return [code];
      const boards = await executeQuery('SELECT * FROM noteboard WHERE universe_id = ?', [ universe.id ]);
      return [200, boards];
    } catch (err) {
      logger.error(err);
      return [500];
    }
  }

  async getByBoardShortname(user, shortname, conditions, options, validate=true, inclAuthors=false) {
    try {
      const boards = await executeQuery('SELECT * FROM noteboard WHERE shortname = ?', [ shortname ]) as Board[];
      const board = boards[0];
      if (!board) return [404];
      if (validate) {
        const [code, universe] = await this.api.universe.getOne(user, { 'universe.id': board.universe_id }, perms.READ);
        if (!universe) return [code];
      }
      const [_, notes] = await this.getMany(
        user,
        { ...conditions ?? {}, 'boardnote.board_id': board.id },
        { ...options ?? {} },
      );
      if (inclAuthors) {
        const queryString2 = `
          SELECT user.id, user.username, user.email
          FROM user
          INNER JOIN note ON user.id = note.author_id
          INNER JOIN boardnote ON boardnote.note_id = note.id
          WHERE boardnote.board_id = ?
          GROUP BY user.id`;
        const users = await executeQuery(queryString2, [ board.id ]);
        return [200, notes, users];
      }
      return [200, notes];
    } catch (err) {
      logger.error(err);
      return [500];
    }
  }

  async postBoard(user, { title, shortname }, universeShortname) {
    if (!user) return [401];
    try {
      const [code, universe] = await this.api.universe.getOne(user, { 'universe.shortname': universeShortname }, perms.WRITE);
      if (!universe) return [code];

      const queryString = `INSERT INTO noteboard (title, shortname, universe_id) VALUES (?, ?, ?);`;
      const data = await executeQuery(queryString, [ title, shortname, universe.id ]);
      return [201, data];
    } catch (err) {
      logger.error(err);
      return [500];
    }
  }

  /**
   * 
   * @param {*} user 
   * @param {*} param1 
   * @returns {Promise<[number, QueryResult, number]>}
   */
  async post(user, { title, body, public, tags }) {
    if (!user) return [401];
    try {
      const uuid = crypto.randomUUID();

      const queryString = `INSERT INTO note (uuid, title, body, public, author_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?);`;
      const data = await executeQuery(queryString, [ uuid, title, body, public, user.id, new Date(), new Date() ]);

      const trimmedTags = tags.map(tag => tag[0] === '#' ? tag.substring(1) : tag);
      putTags(user, uuid, trimmedTags);

      return [201, data, uuid];
    } catch (err) {
      logger.error(err);
      return [500];
    }
  }

  async put(user, uuid, changes) {
    const { title, body, public, items, boards, tags } = changes;
    const [code, note] = await getOne(user, uuid);
    if (!note) return [code];

    try {
      const queryString = `
        UPDATE note
        SET
          title = ?,
          body = ?,
          public = ?
        WHERE uuid = ?;
      `;
      const data = await executeQuery(queryString, [ title, body, public, note.uuid ]);

      await executeQuery('DELETE FROM itemnote WHERE note_id = ?', [ note.id ]);
      for (const { item, universe } of items ?? []) {
        await linkToItem(user, universe, item, uuid);
      }
      
      if (tags) {
        const trimmedTags = tags.map(tag => tag[0] === '#' ? tag.substring(1) : tag);

        // If tags list is provided, we can just as well handle it here
        await putTags(user, uuid, trimmedTags);
        const tagLookup = {};
        note.tags?.forEach(tag => {
          tagLookup[tag] = true;
        });
        trimmedTags.forEach(tag => {
          delete tagLookup[tag];
        });
        await delTags(user, uuid, Object.keys(tagLookup));
      }

      return [200, data];
    } catch (err) {
      logger.error(err);
      return [500];
    }
  }

  async linkToBoard(user, boardShortname, noteUuid) {
    if (!noteUuid) return [400];
    if (!user) return [401];
    const board = await executeQuery('SELECT * FROM noteboard WHERE shortname = ?', [ boardShortname ]);
    if (!board) return [404];
    const [code2, note] = await getOne(user, noteUuid);
    if (!note) return [code2];

    try {
      const queryString = `INSERT INTO boardnote (board_id, note_id) VALUES (?, ?)`;
      await executeQuery(queryString, [ board.id, note.id ])
      return [201];
    } catch (err) {
      logger.error(err);
      return [500];
    }
  }

  async linkToItem(user, universeShortname, itemShortname, noteUuid) {
    if (!noteUuid) return [400];
    if (!user) return [401];
    const [code, item] = await api.item.getByUniverseAndItemShortnames(user, universeShortname, itemShortname, perms.WRITE, true)
    if (!item) return [code];
    const [code2, note] = await getOne(user, noteUuid);
    if (!note) return [code2];

    try {
      const queryString = `INSERT INTO itemnote (item_id, note_id) VALUES (?, ?)`;
      await executeQuery(queryString, [ item.id, note.id ])
      return [201];
    } catch (err) {
      logger.error(err);
      return [500];
    }
  }

  async putTags(user, uuid, tags) {
    if (!tags || tags.length === 0) return [400];
    const [code, note] = await getOne(user, uuid);
    if (!note) return [code];
    try {
      const tagLookup = {};
      note.tags?.forEach(tag => {
        tagLookup[tag] = true;
      });
      const filteredTags = tags.filter(tag => !tagLookup[tag]);
      const valueString = filteredTags.map(() => `(?, ?)`).join(',');
      const valueArray = filteredTags.reduce((arr, tag) => [...arr, note.id, tag], []);
      if (!valueString) return [200];
      const queryString = `INSERT INTO notetag (note_id, tag) VALUES ${valueString};`;
      const data = await executeQuery(queryString, valueArray);
      return [201, data];
    } catch (e) {
      logger.error(e);
      return [500];
    }
  }

  async delTags(user, uuid, tags) {
    if (!tags || tags.length === 0) return [400];
    const [code, note] = await getOne(user, uuid);
    if (!note) return [code];
    try {
      const whereString = tags.map(() => `tag = ?`).join(' OR ');
      if (!whereString) return [200];
      const queryString = `DELETE FROM notetag WHERE note_id = ? AND (${whereString});`;
      const data = await executeQuery(queryString, [ note.id, ...tags ]);
      return [200, data];
    } catch (e) {
      logger.error(e);
      return [500];
    }
  }

  async del(user, uuid) {
    if (!user) return [401];
    try {
      const [code, note] = await getOne(user, uuid);
      if (!note) return [code];

      // getOne will only return a note if we own it, but it doesn't hurt to double check for clarity
      if (note.author_id !== user.id) return [403];

      const data = await executeQuery('DELETE FROM note WHERE uuid = ?', [ uuid ]);

      return [200, data];
    } catch (err) {
      logger.error(err);
      return [500];
    }
  }
}
