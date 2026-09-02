import { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { API } from '..';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../errors';
import { BaseOptions, executeQuery, perms, withTransaction } from '../utils';
import { User } from './user';

export type Vault = {
  id: number,
  universe_id: number,
  title: string,
  shortname: string,
  created_at: Date,
  updated_at: Date,
  authors: { [id: number]: string },
  author_permissions: { [id: number]: perms },
};

export class VaultAPI {
  readonly api: API;

  constructor(api: API) {
    this.api = api;
  }

  async getOne(user: User | undefined, conditions, permissionLevel = perms.READ): Promise<Vault> {
    if (!conditions) throw new ValidationError('Conditions are required.');
    const data = await this.getMany(user, conditions, permissionLevel);
    const vault = data[0];
    if (!vault) {
      const exists = (await executeQuery(`SELECT 1 FROM vault WHERE ${conditions.strings.join(' AND ')}`, conditions.values)).length > 0;
      if (exists) {
        if (user) throw new ForbiddenError();
        else throw new UnauthorizedError();
      } else {
        throw new NotFoundError();
      }
    }
    return vault;
  }

  async getMany(user: User | undefined, conditions: any = null, permissionLevel = perms.READ, options: BaseOptions = {}): Promise<Vault[]> {
    if (!user) throw new UnauthorizedError();

    const usrQueryString = `va_filter.user_id = ${user.id} AND va_filter.permission_level >= ${permissionLevel}`;
    const conditionString = conditions ? `WHERE ${conditions.strings.join(' AND ')}` : '';
    const queryString = `
      SELECT
        vault.*,
        JSON_OBJECTAGG(author.id, author.username) AS authors,
        JSON_OBJECTAGG(author.id, va.permission_level) AS author_permissions
      FROM vault
      INNER JOIN vaultauthor AS va_filter
        ON vault.id = va_filter.vault_id AND (${usrQueryString})
      LEFT JOIN vaultauthor AS va ON vault.id = va.vault_id
      LEFT JOIN user AS author ON author.id = va.user_id
      ${conditionString}
      GROUP BY vault.id
      ORDER BY vault.title ASC`;
    const data = await executeQuery(queryString, conditions && conditions.values) as Vault[];
    return data;
  }

  async getManyByUniverseId(user: User | undefined, universeId: number, permissionLevel = perms.READ): Promise<Vault[]> {
    return this.getMany(user, {
      strings: ['vault.universe_id = ?'],
      values: [universeId],
    }, permissionLevel);
  }

  validateShortname(shortname: string): string | null {
    return this.api.universe.validateShortname(shortname, ['create', 'perms']);
  }

  /**
   * Inserts a vault and grants the creator OWNER on it. If `conn` is provided, runs on the
   * caller's transaction (used when creating a universe's Primary vault); otherwise opens its own.
   */
  async post(user: User | undefined, universeId: number, body: { title: string, shortname: string }, conn?: PoolConnection): Promise<ResultSetHeader> {
    if (!user) throw new UnauthorizedError();
    const { title, shortname } = body;

    if (!title) throw new ValidationError('Title is required.');
    const shortnameError = this.validateShortname(shortname);
    if (shortnameError) throw new ValidationError(shortnameError);

    const insert = async (conn: PoolConnection): Promise<ResultSetHeader> => {
      const [data] = await conn.execute<ResultSetHeader>(`
        INSERT INTO vault (universe_id, title, shortname, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?);
      `, [universeId, title, shortname, new Date(), new Date()]);

      await conn.execute(
        'INSERT INTO vaultauthor (vault_id, user_id, permission_level) VALUES (?, ?, ?)',
        [data.insertId, user.id, perms.OWNER],
      );

      return data;
    };

    try {
      if (conn) return await insert(conn);
      let data!: ResultSetHeader;
      await withTransaction(async (conn) => { data = await insert(conn); });
      return data;
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') throw new ValidationError('Vault shortname must be unique within this universe.');
      throw err;
    }
  }

  async putPermissions(user: User | undefined, vaultShortname: string, universeId: number, targetUser: User, permission_level: perms): Promise<ResultSetHeader> {
    if (!user) throw new UnauthorizedError();

    const vault = await this.getOne(
      user,
      { strings: ['vault.shortname = ?', 'vault.universe_id = ?'], values: [vaultShortname, universeId] },
      permission_level === perms.OWNER ? perms.OWNER : Math.max(perms.ADMIN, permission_level + 1),
    );

    if ((vault.author_permissions[targetUser.id] ?? perms.NONE) > (vault.author_permissions[user.id] ?? perms.NONE)) {
      throw new ForbiddenError();
    }

    if (vault.author_permissions[targetUser.id] === perms.OWNER && permission_level < perms.OWNER) {
      let ownerWouldStillExist = false;
      for (const userID in vault.author_permissions) {
        if (Number(userID) !== Number(targetUser.id) && vault.author_permissions[userID] === perms.OWNER) {
          ownerWouldStillExist = true;
          break;
        }
      }
      if (!ownerWouldStillExist) throw new ValidationError('Cannot remove the last owner.');
    }

    if (targetUser.id in vault.author_permissions) {
      if (permission_level === perms.NONE) {
        return executeQuery(
          'DELETE FROM vaultauthor WHERE vault_id = ? AND user_id = ?',
          [vault.id, targetUser.id],
        );
      } else {
        return executeQuery(
          'UPDATE vaultauthor SET permission_level = ? WHERE user_id = ? AND vault_id = ?',
          [permission_level, targetUser.id, vault.id],
        );
      }
    } else {
      return executeQuery(
        'INSERT INTO vaultauthor (permission_level, vault_id, user_id) VALUES (?, ?, ?)',
        [permission_level, vault.id, targetUser.id],
      );
    }
  }

  async del(user: User | undefined, universeId: number, vaultShortname: string): Promise<void> {
    const vault = await this.getOne(
      user,
      { strings: ['vault.shortname = ?', 'vault.universe_id = ?'], values: [vaultShortname, universeId] },
      perms.OWNER,
    );

    await executeQuery('DELETE FROM vault WHERE id = ?', [vault.id]);
  }
}
