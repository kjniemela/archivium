import { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { API } from '..';
import { ForbiddenError, ModelError, NotFoundError, UnauthorizedError, ValidationError } from '../../errors';
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
  requester_permissions: perms,
  items?: number,
};

type VaultOptions = BaseOptions & {
  itemCounts?: boolean,
};

export class VaultAPI {
  readonly api: API;

  constructor(api: API) {
    this.api = api;
  }

  async getOne(user: User | undefined, conditions, permissionLevel = perms.READ, options: VaultOptions = {}): Promise<Vault> {
    if (!conditions) throw new ValidationError('Conditions are required.');
    const data = await this.getMany(user, conditions, permissionLevel, options);
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

  async getMany(user: User | undefined, conditions: any = null, permissionLevel = perms.READ, options: VaultOptions = {}): Promise<Vault[]> {
    if (!user) throw new UnauthorizedError();

    const permsQueryString = `
      va_filter.permission_level >= ${permissionLevel}
      OR au_filter.permission_level >= ${perms.OWNER}
    `;
    const conditionString = conditions ? `${conditions.strings.join(' AND ')} AND` : '';
    const queryString = `
      SELECT
        vault.*,
        ${options.itemCounts ? 'COUNT(item.id) AS items,' : ''}
        JSON_REMOVE(JSON_OBJECTAGG(
          IFNULL(author.id, 'null__'),
          IFNULL(author.username, '')
        ), '$.null__') AS authors,
        JSON_REMOVE(JSON_OBJECTAGG(
          IFNULL(author.id, 'null__'),
          IFNULL(va.permission_level, 0)
        ), '$.null__') AS author_permissions,
        GREATEST(
          IFNULL(MAX(va_filter.permission_level), ${perms.NONE}),
          IF(IFNULL(MAX(au_filter.permission_level), ${perms.NONE}) >= ${perms.OWNER}, ${perms.OWNER}, ${perms.NONE})
        ) AS requester_permissions
      FROM vault
      LEFT JOIN vaultauthor AS va_filter
        ON vault.id = va_filter.vault_id AND va_filter.user_id = ${user.id}
      LEFT JOIN authoruniverse AS au_filter
        ON vault.universe_id = au_filter.universe_id AND au_filter.user_id = ${user.id}
      LEFT JOIN vaultauthor AS va ON vault.id = va.vault_id
      LEFT JOIN user AS author ON author.id = va.user_id
      ${options.itemCounts ? 'LEFT JOIN item ON item.vault_id = vault.id' : ''}
      WHERE ${conditionString} (${permsQueryString})
      GROUP BY vault.id
      ORDER BY vault.title ASC`;
    const data = await executeQuery(queryString, conditions && conditions.values) as Vault[];
    return data;
  }

  async getManyByUniverseShortname(
    user: User | undefined,
    universeShortname: string,
    permissionLevel = perms.READ,
    options: VaultOptions = {}
  ): Promise<Vault[]> {
    const universe = await this.api.universe.getOne(user, { shortname: universeShortname });
    return this.getMany(user, {
      strings: ['vault.universe_id = ?'],
      values: [universe.id],
    }, permissionLevel, options);
  }

  getOneByShortnames(
    user: User | undefined,
    universeShortname: string,
    vaultShortname: string,
    permissionLevel = perms.READ,
    options: VaultOptions = {}
  ): Promise<Vault> {
    return this.getOne(user, {
      strings: ['vault.shortname = ?', 'vault.universe_id = (SELECT id FROM universe WHERE shortname = ?)'],
      values: [vaultShortname, universeShortname],
    }, permissionLevel, options);
  }

  validateShortname(shortname: string): string | null {
    return this.api.universe.validateShortname(shortname, ['create', 'perms']);
  }

  async post(user: User | undefined, universeShortname: string, body: { title: string, shortname: string }, conn?: PoolConnection): Promise<ResultSetHeader> {
    if (!user) throw new UnauthorizedError();
    const { title, shortname } = body;

    if (!title) throw new ValidationError('Title is required.');
    const shortnameError = this.validateShortname(shortname);
    if (shortnameError) throw new ValidationError(shortnameError);

    const universe = await this.api.universe.getOne(user, { shortname: universeShortname }, perms.ADMIN);

    const insert = async (conn: PoolConnection): Promise<ResultSetHeader> => {
      const [data] = await conn.execute<ResultSetHeader>(`
        INSERT INTO vault (universe_id, title, shortname, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?);
      `, [universe.id, title, shortname, new Date(), new Date()]);

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

  async putPermissions(user: User | undefined, universeShortname: string, vaultShortname: string, targetUser: User, permission_level: perms): Promise<ResultSetHeader> {
    if (!user) throw new UnauthorizedError();

    const vault = await this.getOneByShortnames(
      user,
      universeShortname,
      vaultShortname,
      permission_level === perms.OWNER ? perms.OWNER : Math.max(perms.ADMIN, permission_level + 1),
    );

    if ((vault.author_permissions[targetUser.id] ?? perms.NONE) > vault.requester_permissions) {
      throw new ForbiddenError();
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

  async del(user: User | undefined, universeShortname: string, vaultShortname: string): Promise<void> {
    const vault = await this.getOneByShortnames(user, universeShortname, vaultShortname, perms.OWNER, { itemCounts: true });

    if (vault.items === undefined) {
      // We requested an item count but got none - abort.
      throw new ModelError('Internal server error while validating that vault is empty, aborting.');
    }

    if (vault.items > 0) {
      throw new ValidationError(
        `Cannot delete ${vault.title} while it still contains ${vault.items === 1 ? '1 item' : `${vault.items} items`}. `
        + 'Move them to another vault or out of the vault first.',
      );
    }

    await executeQuery('DELETE FROM vault WHERE id = ?', [vault.id]);
  }
}
