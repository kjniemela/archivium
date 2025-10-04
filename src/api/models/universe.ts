import { executeQuery, parseData, perms, withTransaction, tiers, tierAllowance, BaseOptions, Tier } from '../utils';
import logger from '../../logger';
import { API } from '..';
import { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { User } from './user';
import { ForbiddenError, ModelError, NotFoundError, UnauthorizedError, ValidationError } from '../../errors';
import { ItemEvent } from './item';

export type UniverseAccessRequest = {
  universe_id: number,
  user_id: number,
  permission_level: perms,
};

export type Universe = {
  id: number,
  title: string,
  shortname: string,
  author_id: number,
  created_at: Date,
  updated_at: Date,
  is_public: boolean,
  discussion_enabled: boolean,
  discussion_open: boolean,
  obj_data: Object | string,
  authors: { [id: number]: string },
  author_permissions: { [id: number]: perms },
  owner: string,
  followers: { [id: number]: boolean },
  tier: Tier | null,
  sponsoring_user: number,
};

export type ParsedUniverse = Universe & { obj_data: Object };
export type StringifiedUniverse = Universe & { obj_data: string };

const validateShortname = (shortname: string, reservedShortnames: string[] = ['create']) => {
  if (shortname.length < 3 || shortname.length > 64) {
    return 'Shortnames must be between 3 and 64 characters long.';
  }

  if (reservedShortnames.includes(shortname)) {
    return 'This shortname is reserved and cannot be used.';
  }

  if (/^[-]|[-]$/.test(shortname)) {
    return 'Shortnames cannot start or end with a dash.';
  }

  if (!/^[a-zA-Z0-9-]+$/.test(shortname)) {
    return 'Shortnames can only contain letters, numbers, and hyphens.';
  }

  return null;
}

export class UniverseAPI {
  readonly api: API;
  readonly validateShortname = validateShortname;

  constructor(api: API) {
    this.api = api;
  }

  async getOne(user: User | undefined, conditions, permissionLevel = perms.READ): Promise<ParsedUniverse> {
    if (!conditions) throw new ValidationError('Conditions are required.');
    const parsedConditions = parseData(conditions);
    const data = await this.getMany(user, parsedConditions, permissionLevel);
    const universe = data[0];
    if (!universe) {
      const exists = (await executeQuery(`SELECT 1 FROM universe WHERE ${parsedConditions.strings.join(' AND ')}`, parsedConditions.values)).length > 0;
      if (exists) {
        if (user) throw new ForbiddenError();
        else throw new UnauthorizedError();
      } else {
        throw new NotFoundError();
      }
    }
    universe.obj_data = JSON.parse(universe.obj_data);
    return universe;
  }

  async getMany(user: User | undefined, conditions: any = null, permissionLevel = perms.READ, options: BaseOptions = {}): Promise<StringifiedUniverse[]> {

    if (options.sort && !options.forceSort) {
      const validSorts = { 'title': true, 'created_at': true, 'updated_at': true };
      if (!validSorts[options.sort]) {
        delete options.sort;
      }
    }

    if (!user && permissionLevel > perms.READ) throw new ValidationError('User is required to access at above read-only permissions.');
    const readOnlyQueryString = permissionLevel > perms.READ ? '' : `universe.is_public = 1`;
    const usrQueryString = user ? `(au_filter.user_id = ${user.id} AND au_filter.permission_level >= ${permissionLevel})` : '';
    const permsQueryString = `${readOnlyQueryString}${(readOnlyQueryString && usrQueryString) ? ' OR ' : ''}${usrQueryString}`;
    const conditionString = conditions ? `WHERE ${conditions.strings.join(' AND ')}` : '';
    const queryString = `
      SELECT 
        universe.*,
        JSON_OBJECTAGG(author.id, author.username) AS authors,
        JSON_OBJECTAGG(author.id, au.permission_level) AS author_permissions,
        owner.username AS owner,
        JSON_REMOVE(JSON_OBJECTAGG(
          IFNULL(fu.user_id, 'null__'),
          fu.is_following
        ), '$.null__') AS followers,
        usu.tier AS tier,
        usu.user_id AS sponsoring_user
      FROM universe
      INNER JOIN authoruniverse AS au_filter
        ON universe.id = au_filter.universe_id AND (
          ${permsQueryString}
        )
      LEFT JOIN authoruniverse AS au ON universe.id = au.universe_id
      LEFT JOIN user AS author ON author.id = au.user_id
      LEFT JOIN followeruniverse AS fu ON universe.id = fu.universe_id
      LEFT JOIN user AS owner ON universe.author_id = owner.id
      LEFT JOIN usersponsoreduniverse AS usu ON universe.id = usu.universe_id
      ${conditionString}
      GROUP BY universe.id
      ORDER BY ${options.sort ? `${options.sort} ${options.sortDesc ? 'DESC' : 'ASC'}` : 'updated_at DESC'}`;
    const data = await executeQuery(queryString, conditions && conditions.values) as StringifiedUniverse[];
    return data;
  }

  getManyByAuthorId(user, authorId, permissionLevel = perms.WRITE): Promise<StringifiedUniverse[]> {
    return this.getMany(user, {
      strings: [`
        EXISTS (
          SELECT 1
          FROM authoruniverse as au_check
          WHERE au_check.universe_id = universe.id
          AND (au_check.user_id = ? AND au_check.permission_level >= ?)
        )
      `], values: [
        authorId,
        permissionLevel,
      ]
    });
  }

  getManyByAuthorName(user, authorName): Promise<StringifiedUniverse[]> {
    return this.getMany(user, {
      strings: [`
        EXISTS (
          SELECT 1
          FROM authoruniverse as au_check
          WHERE au_check.universe_id = universe.id
          AND (au_check.username = ? AND au_check.permission_level >= ?)
        )
      `], values: [
        authorName,
        perms.READ,
      ]
    });
  }

  async getEventsByUniverseShortname(user: User | undefined, shortname: string, permissionsRequired = perms.READ): Promise<ItemEvent[]> {
    const universe = await this.getOne(user, { 'universe.shortname': shortname }, permissionsRequired);

    const queryString = `
      SELECT
        itemevent.event_title, itemevent.abstime,
        item.shortname AS src_shortname, item.title AS src_title, item.id AS src_id
      FROM itemevent
      INNER JOIN item on item.id = itemevent.item_id
      WHERE item.universe_id = ?
    `;
    return await executeQuery(queryString, [universe.id]) as ItemEvent[];
  }

  // Does not throw if universe has no body..
  async getPublicBodyByShortname(shortname: string): Promise<string | void> {
    const queryString = `SELECT obj_data FROM universe WHERE shortname = ?`;
    const rows = (await executeQuery(queryString, [shortname]))[0];
    if (!rows) throw new NotFoundError();
    const body = JSON.parse(rows.obj_data)?.publicBody;
    if (!body) return;
    return body;
  }

  async getTotalStoredByShortname(shortname: string): Promise<number> {
    const queryString = `
      SELECT SUM(OCTET_LENGTH(image.data)) AS size
      FROM universe
      INNER JOIN item ON item.universe_id = universe.id
      INNER JOIN itemimage ON itemimage.item_id = item.id
      INNER JOIN image ON image.id = itemimage.image_id
      WHERE universe.shortname = ?
      GROUP BY universe.title
    `;

    const rows = await executeQuery<ResultSetHeader>(queryString, [shortname])
    if (!rows) throw new NotFoundError();
    return Number(rows[0].size);
  }

  async post(user: User | undefined, body): Promise<[ResultSetHeader, ResultSetHeader]> {
    if (!user) throw new UnauthorizedError();

    try {
      const { title, shortname, is_public, discussion_enabled, discussion_open, obj_data } = body;

      const shortnameError = this.validateShortname(shortname);
      if (shortnameError) throw new ValidationError(shortnameError);
      if (!title) throw new ValidationError('Title is required.');

      const queryString1 = `
        INSERT INTO universe (
          title,
          shortname,
          author_id,
          is_public,
          discussion_enabled,
          discussion_open,
          obj_data,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
      `;
      const data = await executeQuery<ResultSetHeader>(queryString1, [
        title,
        shortname,
        user.id,
        is_public,
        discussion_enabled,
        discussion_open,
        obj_data,
        new Date(),
        new Date(),
      ]);
      const queryString2 = `INSERT INTO authoruniverse (universe_id, user_id, permission_level) VALUES (?, ?, ?)`;
      return [data, await executeQuery<ResultSetHeader>(queryString2, [data.insertId, user.id, perms.OWNER])];
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') throw new ValidationError('Universe shortname must be unique.');
      if (err.code === 'ER_BAD_NULL_ERROR') throw new ValidationError('Missing parameters.');
      throw err;
    }
  }

  async putUpdatedAtWithTransaction(conn: PoolConnection, universeId: number, updatedAt: Date): Promise<void> {
    await conn.execute('UPDATE universe SET updated_at = ? WHERE id = ?', [updatedAt, universeId]);
  }

  async put(user: User | undefined, universeShortname: string, changes): Promise<number> {
    const { title, shortname, is_public, discussion_enabled, discussion_open, obj_data } = changes;

    if (!title) throw new ValidationError('Title is required.');
    const universe = await this.getOne(user, { shortname: universeShortname }, perms.WRITE);

    if (shortname !== null && shortname !== undefined && shortname !== universe.shortname) {
      // The item shortname has changed, we need to update all links to it to reflect this
      const shortnameError = this.validateShortname(shortname);
      if (shortnameError) throw new ValidationError(shortnameError);

      await executeQuery('UPDATE itemlink SET to_universe_short = ? WHERE to_universe_short = ?', [shortname, universe.shortname]);
    }


    const queryString = `
      UPDATE universe
      SET
        title = ?,
        shortname = ?,
        is_public = ?,
        discussion_enabled = ?,
        discussion_open = ?,
        obj_data = ?,
        updated_at = ?
      WHERE id = ?
    `;
    await executeQuery(queryString, [title, shortname ?? universe.shortname, is_public, discussion_enabled, discussion_open, obj_data, new Date(), universe.id]);
    return universe.id;
  }

  async putPermissions(user: User | undefined, shortname: string, targetUser: User, permission_level: perms): Promise<ResultSetHeader> {
    if (!user) throw new UnauthorizedError();
    const universe = await this.getOne(
      user,
      { shortname },
      permission_level === perms.OWNER ? perms.OWNER : Math.max(perms.ADMIN, permission_level + 1),
    );

    if (universe.author_permissions[targetUser.id] > universe.author_permissions[user.id]) throw new ForbiddenError();

    if (universe.author_permissions[targetUser.id] === perms.OWNER && permission_level < perms.OWNER) {
      let ownerWouldStillExist = false;
      for (const userID in universe.author_permissions) {
        if (Number(userID) !== Number(targetUser.id) && universe.author_permissions[userID] === perms.OWNER) {
          ownerWouldStillExist = true;
          break;
        }
      }
      if (!ownerWouldStillExist) throw new ValidationError('Cannot remove the last owner.');
    }

    let query: Promise<ResultSetHeader>;
    if (targetUser.id in universe.author_permissions) {
      query = executeQuery(`
        UPDATE authoruniverse 
        SET permission_level = ? 
        WHERE user_id = ? AND universe_id = ?`,
        [permission_level, targetUser.id, universe.id],
      );
    } else {
      query = executeQuery(`
        INSERT INTO authoruniverse (permission_level, universe_id, user_id) VALUES (?, ?, ?)`,
        [permission_level, universe.id, targetUser.id],
      );
    }

    await executeQuery(
      'DELETE FROM universeaccessrequest WHERE universe_id = ? AND user_id = ?',
      [universe.id, targetUser.id],
    );

    return await query;
  }

  async putUserFollowing(user: User | undefined, shortname: string, isFollowing: boolean): Promise<ResultSetHeader> {
    if (!user) throw new UnauthorizedError();
    const universe = await this.getOne(user, { shortname }, perms.READ);

    let query: Promise<ResultSetHeader>;
    if (user.id in universe.followers) {
      query = executeQuery(`
        UPDATE followeruniverse 
        SET is_following = ? 
        WHERE user_id = ? AND universe_id = ?;`,
        [isFollowing, user.id, universe.id],
      );
    } else {
      query = executeQuery(`
        INSERT INTO followeruniverse (is_following, universe_id, user_id) VALUES (?, ?, ?)`,
        [isFollowing, universe.id, user.id],
      );
    }

    return await query;
  }

  async putUserSponsoring(user: User | undefined, shortname: string, tier: Tier): Promise<void> {
    if (!user) throw new UnauthorizedError();
    const universe = await this.getOne(user, { shortname }, perms.ADMIN);
    if (universe.sponsoring_user !== null && universe.sponsoring_user !== user.id) {
      await this.getOne(user, { shortname }, perms.OWNER); // check if we have owner permissions
    }
    if (universe.tier === tier) return; // Already at desired tier, do nothing

    let query;
    if (tier === tiers.FREE) {
      if (universe.tier === null) return; // Already free, do nothing
      query = executeQuery(`DELETE FROM usersponsoreduniverse WHERE universe_id = ?`, [universe.id]);
    } else {
      if (user.plan === undefined) throw new ValidationError('User plan is required.');
      const sponsored = await this.api.user.getSponsoredUniverses(user);
      const sponsoredAtTier = sponsored.filter(row => row.tier === tier)[0]?.universes.length;
      if (sponsoredAtTier >= tierAllowance[user.plan][tier]) throw new ForbiddenError();
      if (universe.tier === null) {
        query = executeQuery(`
          INSERT INTO usersponsoreduniverse (universe_id, user_id, tier) VALUES (?, ?, ?)`,
          [universe.id, user.id, tier],
        );
      } else {
        query = executeQuery(`
          UPDATE usersponsoreduniverse 
          SET user_id = ? AND tier = ?
          WHERE universe_id = ?;`,
          [user.id, tier, universe.id],
        );
      }
    }

    await query;
  }

  async getUserAccessRequestIfExists(user: User | undefined, shortname: string): Promise<UniverseAccessRequest | null> {
    if (!user) throw new UnauthorizedError();

    const universe = (await executeQuery('SELECT * FROM universe WHERE shortname = ?', [shortname]))[0];
    if (!universe) throw new NotFoundError();

    const request = (await executeQuery(
      'SELECT * FROM universeaccessrequest WHERE universe_id = ? AND user_id = ?',
      [universe.id, user.id],
    ))[0] as UniverseAccessRequest;
    if (!request) return null;

    return request;
  }

  async getAccessRequests(user: User | undefined, shortname: string): Promise<UniverseAccessRequest[]> {
    if (!user) throw new UnauthorizedError();

    const universe = await this.getOne(user, { shortname }, perms.ADMIN);

    const requests = await executeQuery(
      'SELECT ua.*, user.username FROM universeaccessrequest ua INNER JOIN user ON user.id = ua.user_id WHERE ua.universe_id = ?',
      [universe.id],
    ) as UniverseAccessRequest[];

    return requests;
  }

  async putAccessRequest(user: User | undefined, shortname: string, permissionLevel: perms): Promise<void> {
    if (!user) throw new UnauthorizedError();

    const universe = (await executeQuery('SELECT * FROM universe WHERE shortname = ?', [shortname]))[0];
    if (!universe) throw new NotFoundError();

    const request = await this.getUserAccessRequestIfExists(user, shortname);
    if (request) {
      if (request.permission_level >= permissionLevel) return;
      else await this.delAccessRequest(user, shortname, user);
    }

    await executeQuery<ResultSetHeader>(
      'INSERT INTO universeaccessrequest (universe_id, user_id, permission_level) VALUES (?, ?, ?)',
      [universe.id, user.id, permissionLevel],
    );
  }

  async delAccessRequest(user: User | undefined, shortname: string, requestingUser: User): Promise<void> {
    if (!user) throw new UnauthorizedError();
    if (!requestingUser) throw new ValidationError('Requesting user is required.');
    const permsUniverse = await this.getOne(user, { shortname }, perms.ADMIN);
    if (!(permsUniverse || (user.id === requestingUser.id))) throw new ForbiddenError();

    const universe = (await executeQuery('SELECT * FROM universe WHERE shortname = ?', [shortname]))[0];
    await executeQuery(
      'DELETE FROM universeaccessrequest WHERE universe_id = ? AND user_id = ?',
      [universe.id, requestingUser.id],
    );
  }

  async del(user: User | undefined, shortname: string): Promise<void> {
    const universe = await this.getOne(user, { shortname }, perms.OWNER);

    await withTransaction(async (conn) => {
      await conn.execute(`
        DELETE comment
        FROM comment
        INNER JOIN threadcomment AS tc ON tc.comment_id = comment.id
        INNER JOIN discussion ON tc.thread_id = discussion.id
        WHERE discussion.universe_id = ?;
      `, [universe.id]);
      await conn.execute(`
        DELETE comment
        FROM comment
        INNER JOIN itemcomment AS ic ON ic.comment_id = comment.id
        INNER JOIN item ON ic.item_id = item.id
        WHERE item.universe_id = ?;
      `, [universe.id]);
      await conn.execute(`DELETE FROM universe WHERE id = ?;`, [universe.id]);
    });
  }
}