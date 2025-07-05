import { executeQuery, parseData } from '../utils';
import utils from '../../lib/hashUtils';
import { API } from '..';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { User } from './user';
import { ModelError } from '../../errors';

export type Session = {
  id: number;
  hash: string;
  user_id?: number;
  created_at: Date;
  user?: User;
} & RowDataPacket;

export type SessionConditions = {
  id?: number;
  hash?: string;
  user_id?: number;
  created_at?: Date;
};

export type SessionChanges = {
  user_id?: number;
};

export class SessionAPI {
  readonly api: API;

  constructor(api: API) {
    this.api = api;
  }

  // Unlike other models, this one will not throw on missing data, but will return undefined instead.
  async getOne(options: SessionConditions): Promise<Session | undefined> {
    try {
      const parsedOptions = parseData(options);
      const queryString = `SELECT * FROM session WHERE ${parsedOptions.strings.join(' AND ')} LIMIT 1;`;
      const data = await executeQuery<Session[]>(queryString, parsedOptions.values);
      const session = data[0];
      if (!session || !session.user_id) return session;
      const user = await this.api.user.getOne({ 'user.id': session.user_id }, false, true);
      session.user = user;
      return session;
    } catch (err) {
      throw new ModelError(err);
    }
  }

  async post(): Promise<ResultSetHeader> {
    try {
      const data = utils.createRandom32String();
      const hash = utils.createHash(data);
      const queryString = `INSERT INTO session (hash, created_at) VALUES (?, ?);`;
      return await executeQuery<ResultSetHeader>(queryString, [ hash, new Date() ]);
    } catch (err) {
      throw new ModelError(err);
    }
  }

  async put(options: SessionConditions, changes: SessionChanges): Promise<ResultSetHeader> {
    try {
      const { user_id } = changes;
      const parsedOptions = parseData(options);
      const queryString = `UPDATE session SET user_id = ? WHERE ${parsedOptions.strings.join(' AND ')}`;
      return await executeQuery<ResultSetHeader>(queryString, [user_id, ...parsedOptions.values]);
    } catch (err) {
      throw new ModelError(err);
    }
  }

  /**
   * for internal use only - does not conform to the standard return format!
   * @param options 
   * @returns {Promise<ResultSetHeader>}
   */
  async del(options: SessionConditions): Promise<ResultSetHeader> {
    try {
      const parsedOptions = parseData(options);
      const queryString = `DELETE FROM session WHERE ${parsedOptions.strings.join(' AND ')}`;
      return await executeQuery<ResultSetHeader>(queryString, parsedOptions.values);
    } catch (err) {
      throw new ModelError(err);
    }
  }

  /**
   * Alias for del method to maintain compatibility TODO: fix this!
   * @param options 
   * @returns {Promise<ResultSetHeader>}
   */
  async delete(options: SessionConditions): Promise<ResultSetHeader> {
    return this.del(options);
  }
} 