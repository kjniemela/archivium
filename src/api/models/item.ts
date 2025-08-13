import { QueryBuilder, Cond, executeQuery, parseData, perms, withTransaction, BaseOptions, handleAsNull } from '../utils';
import { extractLinks } from '../../markdown';
import { API } from '..';
import { User } from './user';
import { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { ItemEvent } from './universe';
import { ForbiddenError, ModelError, NotFoundError, UnauthorizedError, ValidationError } from '../../errors';

export type ItemOptions = BaseOptions & {
  type?: string,
  tag?: string,
  universe?: string,
  author?: string,
  includeData?: boolean,
};

export type EventOptions = BaseOptions & {
  title?: string,
};

export type ItemImage = {
  id: number,
  item_id: number,
  name: string,
  mimetype: string,
  label: string,
  data?: Buffer,
};
export type Item = {
  events?: any;
  gallery?: any;
  parents?: any;
  children?: any,
  notifs_enabled: boolean;
  id: number,
  title: string,
  shortname: string,
  item_type: string,
  created_at: Date,
  updated_at: Date,
  universe_id: number,
  author: string,
  universe: string,
  universe_short: string,
  tags?: string[],
  obj_data?: Object | string,
  author_id?: number,
  description?: string,
  is_published?: boolean,
  parent_id?: number,
  images?: ItemImage[],
  comment_count?: number,
  first_activity?: Date,
  last_activity?: Date,
};

function getQuery(selects: [string, string?, (string | string[])?][] = [], permsCond?: Cond, whereConds?: Cond, options: ItemOptions = {}) {
  const query = new QueryBuilder()
    .select('item.id')
    .select('item.title')
    .select('item.shortname')
    .select('item.item_type')
    .select('item.created_at')
    .select('item.updated_at')
    .select('item.universe_id')
    .select('user.username', 'author')
    .select('universe.title', 'universe')
    .select('universe.shortname', 'universe_short');

  for (const args of selects) {
    query.select(...args);
  }

  query.select('tag.tags')
    .from('item')
    .leftJoin('user', new Cond('user.id = item.author_id'))
    .innerJoin('universe', new Cond('universe.id = item.universe_id'))
    .innerJoin(['authoruniverse', 'au_filter'], new Cond('universe.id = au_filter.universe_id').and(permsCond))
    .leftJoin(`(
      SELECT item_id, JSON_ARRAYAGG(tag) as tags
      FROM tag
      GROUP BY item_id
    ) tag`, new Cond('tag.item_id = item.id'))
    .where(whereConds)
    .groupBy(['item.id', 'user.username', 'universe.title', ...(options.groupBy ?? [])]);

  if (options.sort) {
    query.orderBy(options.sort, options.sortDesc);
  } else {
    query.orderBy('updated_at', true);
  }
  if (options.limit) {
    query.limit(options.limit);
  }

  return query;
}

class ItemImageAPI {
  readonly item: ItemAPI;

  constructor(item: ItemAPI) {
    this.item = item;
  }

  async getOneByItemShort(user: User | undefined, universeShortname: string, itemShortname: string, options?): Promise<ItemImage> {
    const item = await this.item.getByUniverseAndItemShortnames(user, universeShortname, itemShortname, perms.READ, true);
    const data = await this.getMany({ item_id: item.id, ...(options ?? {}) }) as ItemImage[];
    const image = data[0];
    if (!image) throw new NotFoundError();
    return image;
  }

  async getMany(options, inclData = true): Promise<ItemImage[]> {
    const parsedOptions = parseData(options);
    let queryString = `
      SELECT 
        id, item_id, name, mimetype, label ${inclData ? ', data' : ''}
      FROM itemimage
    `;
    if (options) queryString += ` WHERE ${parsedOptions.strings.join(' AND ')}`;
    const images = await executeQuery(queryString, parsedOptions.values) as ItemImage[];
    return images;
  }

  async getManyByItemShort(user: User | undefined, universeShortname: string, itemShortname: string, options?: ItemOptions, inclData = false): Promise<ItemImage[]> {
    const item = await this.item.getByUniverseAndItemShortnames(user, universeShortname, itemShortname, perms.READ, true);
    const images = await this.getMany({ item_id: item.id, ...(options ?? {}) }, inclData) as ItemImage[];
    return images;
  }

  async post(user: User | undefined, file: Express.Multer.File | undefined, universeShortname: string, itemShortname: string): Promise<ResultSetHeader> {
    if (!file) throw new ValidationError('Missing required fields');
    if (!user) throw new UnauthorizedError();

    const { originalname, buffer, mimetype } = file;
    const item = await this.item.getByUniverseAndItemShortnames(user, universeShortname, itemShortname, perms.WRITE, true);

    const queryString = `INSERT INTO itemimage (item_id, name, mimetype, data, label) VALUES (?, ?, ?, ?, ?);`;
    return await executeQuery<ResultSetHeader>(queryString, [item.id, originalname.substring(0, 64), mimetype, buffer, '']);
  }

  async putLabel(user: User | undefined, imageId: number, label: string, conn?: PoolConnection): Promise<ResultSetHeader> {
    if (!user) throw new UnauthorizedError();
    const images = await this.getMany({ id: imageId }, false) as ItemImage[];
    const image = images && images[0];
    if (!image) throw new NotFoundError();
    await this.item.getOne(user, { 'item.id': image.item_id }); // we need to get the item here to make sure it exists
    return await executeQuery<ResultSetHeader>(`UPDATE itemimage SET label = ? WHERE id = ?;`, [label, imageId], conn);
  }

  async del(user: User | undefined, imageId: number, conn?: PoolConnection): Promise<void> {
    if (!user) throw new UnauthorizedError();
    const images = await this.getMany({ id: imageId }, false) as ItemImage[];
    const image = images && images[0];
    if (!image) throw new NotFoundError();
    await this.item.getOne(user, { 'item.id': image.item_id }); // we need to get the item here to make sure it exists
    await executeQuery(`DELETE FROM itemimage WHERE id = ?;`, [imageId], conn);
  }
}

export class ItemAPI {
  readonly image: ItemImageAPI;
  readonly api: API;

  constructor(api: API) {
    this.image = new ItemImageAPI(this);
    this.api = api;
  }

  async getOne(user: User | undefined, conditions: any = {}, permissionsRequired = perms.READ, basicOnly = false, options: ItemOptions = {}): Promise<Item> {

    const parsedConditions = parseData(conditions);

    const data = await this.getMany(user, parsedConditions, permissionsRequired, { ...options, limit: 1 });
    const item = data[0];
    if (!item) {
      if (user) throw new ForbiddenError();
      else throw new UnauthorizedError();
    }

    if (!basicOnly) {
      const events = await executeQuery(`
        SELECT DISTINCT
          itemevent.event_title, itemevent.abstime,
          item.shortname AS src_shortname, item.title AS src_title, item.id AS src_id
        FROM itemevent
        LEFT JOIN timelineitem ON timelineitem.event_id = itemevent.id
        INNER JOIN item ON itemevent.item_id = item.id
        WHERE itemevent.item_id = ? OR timelineitem.timeline_id = ?
        ORDER BY itemevent.abstime DESC
      `, [item.id, item.id]);
      item.events = events;

      const gallery = await executeQuery(`
        SELECT
          itemimage.id, itemimage.name, itemimage.label
        FROM itemimage
        WHERE itemimage.item_id = ?
      `, [item.id]);
      item.gallery = gallery;

      const children = await executeQuery(`
        SELECT
          item.shortname AS child_shortname, item.title AS child_title,
          lineage.child_title AS child_label, lineage.parent_title AS parent_label
        FROM lineage
        INNER JOIN item ON item.id = lineage.child_id
        WHERE lineage.parent_id = ?
      `, [item.id]);
      item.children = children;

      const parents = await executeQuery(`
        SELECT
          item.shortname AS parent_shortname, item.title AS parent_title,
          lineage.child_title AS child_label, lineage.parent_title AS parent_label
        FROM lineage
        INNER JOIN item ON item.id = lineage.parent_id
        WHERE lineage.child_id = ?
      `, [item.id]);
      item.parents = parents;

      if (item.obj_data) {
        const objData = JSON.parse(item.obj_data as string);
        if (typeof objData.body === 'string') {
          const links = await executeQuery(`
            SELECT to_universe_short, to_item_short, href
            FROM itemlink
            WHERE from_item = ?
          `, [item.id]);
          const replacements = {};
          const attachments = {};
          for (const { to_universe_short, to_item_short, href } of links) {
            const replacement = to_universe_short === item.universe_short ? `${to_item_short}` : `${to_universe_short}/${to_item_short}`;
            replacements[href] = replacement;
            const match = href.match(/[?#]/);
            const attachment = match ? `${match[0]}${href.slice(match.index + 1)}` : '';
            attachments[href] = attachment;
          }
          objData.body = objData.body.replace(/(?<!\\)(\[[^\]]*?\])\(([^)]+)\)/g, (match, brackets, parens) => {
            if (parens in replacements) {
              return `${brackets}(@${replacements[parens]}${attachments[parens]})`;
            }
            return match;
          });
          item.obj_data = JSON.stringify(objData);
        }
      }

      if (user) {
        const notifs = await executeQuery(`
          SELECT 1 FROM itemnotification WHERE item_id = ? AND user_id = ? AND is_enabled
        `, [item.id, user.id]);
        item.notifs_enabled = notifs.length === 1;
      }
    }

    return item;
  }

  async getMany(user: User | undefined, conditions, permissionsRequired = perms.READ, options: ItemOptions = {}): Promise<Item[]> {
    if (options.type) {
      if (!conditions) conditions = { strings: [], values: [] };
      conditions.strings.push('item.item_type = ?');
      conditions.values.push(options.type);
    }

    if (options.tag) {
      if (!conditions) conditions = { strings: [], values: [] };
      conditions.strings.push('? IN (SELECT tag FROM tag WHERE item_id = item.id)');
      conditions.values.push(options.tag);
    }

    if (options.universe) {
      if (!conditions) conditions = { strings: [], values: [] };
      conditions.strings.push('universe.shortname = ?');
      conditions.values.push(options.universe);
    }

    if (options.author) {
      if (!conditions) conditions = { strings: [], values: [] };
      conditions.strings.push('user.username = ?');
      conditions.values.push(options.author);
    }

    if (options.sort && !options.forceSort) {
      const validSorts = { 'title': true, 'created_at': true, 'updated_at': true, 'author': true, 'item_type': true };
      if (!validSorts[options.sort]) {
        delete options.sort;
      }
    }

    let permsCond = new Cond();
    if (permissionsRequired <= perms.READ) permsCond = permsCond.or('universe.is_public = ?', 1);
    if (user) permsCond = permsCond.or(
      new Cond('au_filter.user_id = ?', user.id)
        .and('au_filter.permission_level >= ?', permissionsRequired)
    );

    let whereConds = new Cond();
    if (conditions) {
      for (let i = 0; i < conditions.strings.length; i++) {
        whereConds = whereConds.and(conditions.strings[i], conditions.values[i]);
      }
    }
    if (options.where) whereConds = whereConds.and(options.where);

    const selects: [string, string?, (string | string[])?][] = [
      ...(options.select ?? []),
      ...(options.includeData ? [['item.obj_data']] : []) as [string][],
    ];

    const joins = [
      ...(options.join ?? []),
    ];

    if (options.search) {
      const searchCond = new Cond('item.title LIKE ?', `%${options.search}%`)
        .or('item.shortname LIKE ?', `%${options.search}%`)
        .or('search_tag.tag = ?', options.search)
        .or('search_tag.tag LIKE ?', `%${options.search}%`)
        .or(`JSON_UNQUOTE(JSON_EXTRACT(item.obj_data, '$.body')) LIKE ?`, `%${options.search}%`);
      whereConds = whereConds.and(searchCond);
      selects.push([`LOCATE(?, JSON_UNQUOTE(JSON_EXTRACT(item.obj_data, '$.body'))) AS match_pos`, undefined, options.search]);
      selects.push([`
          CASE
            WHEN LOCATE(?, JSON_UNQUOTE(JSON_EXTRACT(item.obj_data, '$.body'))) > 0
            THEN SUBSTRING(
              JSON_UNQUOTE(JSON_EXTRACT(item.obj_data, '$.body')),
              GREATEST(1, LOCATE(?, JSON_UNQUOTE(JSON_EXTRACT(item.obj_data, '$.body'))) - 50),
              100
            )
            ELSE NULL
          END AS snippet`,
        undefined, [options.search, options.search],
      ]);
    }
    const query = getQuery(selects, permsCond, whereConds, options);
    for (const join of joins) {
      query.join(...join);
    }
    if (options.search) {
      query.innerJoin(['tag', 'search_tag'], new Cond('search_tag.item_id = item.id'));
    }
    const data = await query.execute() as Item[];

    return data;
  }

  async getByAuthorUsername(user, username, permissionsRequired, options): Promise<Item[]> {

    const conditions = {
      strings: [
        'user.username = ?',
      ], values: [
        username,
      ]
    };

    const items = await this.getMany(user, conditions, permissionsRequired, options);
    return items;
  }

  async getByUniverseId(user, universeId, permissionsRequired, options): Promise<Item[]> {

    const conditions = {
      strings: [
        'item.universe_id = ?',
      ], values: [
        universeId,
      ]
    };

    const items = await this.getMany(user, conditions, permissionsRequired, options);
    return items;
  }

  async getByUniverseAndItemIds(user, universeId, itemId, permissionsRequired = perms.READ): Promise<Item> {

    const conditions = {
      strings: [
        'item.universe_id = ?',
        'item.id = ?',
      ], values: [
        universeId,
        itemId,
      ]
    };

    const data = await this.getMany(user, conditions, permissionsRequired);
    const item = data[0];
    if (!item) {
      if (user) throw new ForbiddenError();
      else throw new UnauthorizedError();
    }
    return item;
  }

  async getByUniverseShortname(user: User | undefined, shortname: string, permissionsRequired = perms.READ, options?: ItemOptions): Promise<Item[]> {

    const conditions = {
      strings: [
        'universe.shortname = ?',
      ], values: [
        shortname,
      ]
    };

    const items = await this.getMany(user, conditions, permissionsRequired, options);
    return items;
  }

  async getByUniverseAndItemShortnames(
    user: User | undefined,
    universeShortname: string,
    itemShortname: string,
    permissionsRequired = perms.READ,
    basicOnly = false
  ): Promise<Item> {

    const conditions = {
      'universe.shortname': universeShortname,
      'item.shortname': itemShortname,
    };

    return await this.getOne(user, conditions, permissionsRequired, basicOnly, { includeData: true });
  }

  /**
   * 
   * @param {*} user 
   * @param {*} universe 
   * @param {*} validate 
   * @returns {Promise<[number, QueryResult]>}
   */
  async getCountsByUniverse(user, universe, validate = true): Promise<[{ [type: string]: number }, number]> {
    if (!universe.is_public && validate) {
      if (!user) throw new UnauthorizedError();
      if (!(universe.author_permissions[user.id] >= perms.READ)) throw new ForbiddenError();
    }

    const data = await executeQuery('SELECT item_type, COUNT(*) AS count FROM item WHERE universe_id = ? GROUP BY item_type', [universe.id]);
    const counts = {};
    let total = 0;
    for (const row of data) {
      counts[row.item_type] = row.count;
      total += row.count;
    }
    return [counts, total];
  }

  async forEachUserToNotify(item, callback): Promise<void> {
    const targetIDs = (await executeQuery(`SELECT user_id FROM itemnotification WHERE item_id = ? AND is_enabled`, [item.id])).map(row => row.user_id);
    for (const userID of targetIDs) {
      const user = await this.api.user.getOne({ 'user.id': userID });
      await callback(user);
    }
  }

  async post(user: User | undefined, body, universeShortName: string): Promise<ResultSetHeader> {
    if (!user) throw new UnauthorizedError();
    const { title, shortname, item_type, parent_id, obj_data } = body;

    try {
      const shortnameError = this.api.universe.validateShortname(shortname);
      if (shortnameError) throw new ValidationError(shortnameError);

      const universe = await this.api.universe.getOne(user, { 'universe.shortname': universeShortName }, perms.WRITE);
      if (!title || !shortname || !item_type || !obj_data) throw new ValidationError('Missing required fields');

      let data: ResultSetHeader | undefined;
      await withTransaction(async (conn) => {
        const queryString = `
          INSERT INTO item (
            title,
            shortname,
            item_type,
            author_id,
            universe_id,
            parent_id,
            obj_data,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        `;
        [data] = await conn.execute<ResultSetHeader>(queryString, [
          title,
          shortname,
          item_type,
          user.id,
          universe.id,
          parent_id ?? null,
          obj_data,
          new Date(),
          new Date(),
        ]);

        await conn.execute(`
          INSERT INTO itemnotification (item_id, user_id, is_enabled) VALUES (?, ?, ?)
        `, [data.insertId, user.id, true]);

        this.api.universe.putUpdatedAtWithTransaction(conn, universe.id, new Date());
      });

      if (!data) {
        throw new ModelError('Failed to insert item');
      }

      return data;
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') throw new ValidationError(`Shortname "${shortname}" already in use in this universe, please choose another.`);
      throw err;
    }
  }

  async save(user: User | undefined, universeShortname: string, itemShortname: string, body: Partial<Item>): Promise<number> {
    let item!: Item;
    await withTransaction(async (conn) => {
      // Actually save item
      const changes = {
        title: body.title,
        shortname: body.shortname,
        item_type: body.item_type,
        obj_data: JSON.stringify(body.obj_data),
        tags: body.tags ?? [],
      };
      const itemId = await this.put(user, universeShortname, itemShortname, changes, conn);

      item = await this.getOne(user, { 'item.id': itemId }, perms.WRITE);

      // Handle lineage data
      if (body.parents && body.children) {
        const [existingParents, existingChildren] = [{}, {}];
        for (const { parent_shortname } of item.parents) existingParents[parent_shortname] = true;
        for (const { child_shortname } of item.children) existingChildren[child_shortname] = true;
        const [newParents, newChildren] = [{}, {}];
        for (const shortname in body.parents ?? {}) {
          const parent = await this.getByUniverseAndItemShortnames(user, universeShortname, shortname, perms.WRITE).catch(handleAsNull([NotFoundError, ForbiddenError]));
          if (!parent) continue;
          newParents[shortname] = true;
          if (!(shortname in existingParents)) {
            await this.putLineage(parent.id, item.id, ...body.parents[shortname] as [string, string], conn);
          }
        }
        for (const shortname in body.children ?? {}) {
          const child = await this.getByUniverseAndItemShortnames(user, universeShortname, shortname, perms.WRITE).catch(handleAsNull([NotFoundError, ForbiddenError]));
          if (!child) continue;
          newChildren[shortname] = true;
          if (!(shortname in existingChildren)) {
            await this.putLineage(item.id, child.id, ...body.children[shortname].reverse() as [string, string], conn);
          }
        }
        for (const { parent_shortname } of item.parents) {
          if (!newParents[parent_shortname]) {
            const parent = await this.getByUniverseAndItemShortnames(user, universeShortname, parent_shortname, perms.WRITE);
            await this.delLineage(parent.id, item.id, conn);
          }
        }
        for (const { child_shortname } of item.children) {
          if (!newChildren[child_shortname]) {
            const child = await this.getByUniverseAndItemShortnames(user, universeShortname, child_shortname, perms.WRITE);
            await this.delLineage(item.id, child.id, conn);
          }
        }
      }

      // Handle timeline data
      if (body.events) {
        const myEvents = body.events?.filter(event => !event.imported);
        const myImports = body.events?.filter(event => event.imported);
        if (myEvents) {
          const events = await this.fetchEvents(item.id);
          const existingEvents = events.reduce((acc, event) => ({ ...acc, [event.event_title ?? null]: event }), {});
          const newEvents = myEvents.filter(event => !existingEvents[event.event_title]);
          const updatedEvents = myEvents.filter(event => existingEvents[event.event_title] && (
            existingEvents[event.event_title].event_title !== event.event_title
            || existingEvents[event.event_title].abstime !== event.abstime
          )).map(({ event_title, abstime }) => ({ event_title, abstime, id: existingEvents[event_title].id }));
          const newEventMap = myEvents.reduce((acc, event) => ({ ...acc, [event.event_title ?? null]: true }), {});
          const deletedEvents = events.filter(event => !newEventMap[event.event_title]).map(event => event.id);
          await this.insertEvents(item.id, newEvents, conn);
          for (const event of updatedEvents) {
            await this.updateEvent(event.id, event, conn);
          }
          await this.deleteEvents(deletedEvents, conn);
        }

        if (myImports) {
          const imports = await this.fetchImports(item.id);
          const existingImports = imports.reduce((acc, ti) => ({ ...acc, [ti.event_id]: ti }), {});
          const newImports: number[] = [];
          const importsMap = {};
          for (const { srcId: itemId, title: eventTitle } of myImports) {
            const event = (await this.fetchEvents(itemId, { title: eventTitle }))[0];
            if (!event) continue;
            if (!(event.id in existingImports)) {
              newImports.push(event.id);
            }
            importsMap[event.id] = true;
          }
          const deletedImports = imports.filter(ti => !importsMap[ti.event_id]).map(ti => ti.event_id);
          await this.importEvents(item.id, newImports, conn);
          await this.deleteImports(item.id, deletedImports, conn);
        }
      }

      if (body.gallery) {
        const existingImages = await this.image.getManyByItemShort(user, universeShortname, item.shortname);
        const oldImages = {};
        const newImages = {};
        for (const img of existingImages ?? []) {
          oldImages[img.id] = img;
        }
        for (const img of body.gallery ?? []) {
          newImages[img.id] = img;
          if (img.label && oldImages[img.id] && img.label !== oldImages[img.id].label) {
            await this.image.putLabel(user, img.id, img.label, conn);
          }
        }
        for (const img of existingImages ?? []) {
          if (!newImages[img.id]) await this.image.del(user, img.id, conn);
        }
      }
    });

    return item.id;
  }

  private async _getLinks(item): Promise<{ to_universe_short: string, to_item_short: string, href: string }[]> {
    const result = await executeQuery('SELECT to_universe_short, to_item_short, href FROM itemlink WHERE from_item = ?', [item.id]);
    return result as { to_universe_short: string, to_item_short: string, href: string }[];
  }

  async getLinks(user: User, universeShortname: string, itemShortname: string): Promise<{ to_universe_short: string, to_item_short: string, href: string }[]> {
    const item = await this.getByUniverseAndItemShortnames(user, universeShortname, itemShortname, perms.WRITE, true);
    return await this._getLinks(item);
  }

  async handleLinks(item: Item, objData: any, conn?: PoolConnection): Promise<void> {
    if (objData.body) {
      if (typeof objData.body === 'string') {
        const bodyText = objData.body;
        const links = await extractLinks(item.universe_short, bodyText, { item: { ...item, obj_data: objData } });
        const oldLinks = await this._getLinks(item);
        const existingLinks = {};
        const newLinks = {};
        for (const { href } of oldLinks) {
          existingLinks[href] = true;
        }
        const doUpdates = async (conn: PoolConnection) => {
          for (const [universeShort, itemShort, href] of links) {
            newLinks[href] = true;
            if (!existingLinks[href]) {
              await conn.execute('INSERT INTO itemlink (from_item, to_universe_short, to_item_short, href) VALUES (?, ?, ?, ?)', [ item.id, universeShort, itemShort, href ]);
            }
          }
          for (const { href } of oldLinks) {
            if (!newLinks[href]) {
              await conn.execute('DELETE FROM itemlink WHERE from_item = ? AND href = ?', [ item.id, href ]);
            }
          }
        };
        if (conn) {
          await doUpdates(conn);
        } else {
          await withTransaction(doUpdates);
        }
      } else {
        // console.log(objData.body.structure);
      }
    }
  }

  async fetchEvents(itemId: number, options: EventOptions = {}): Promise<ItemEvent[]> {
    let queryString = `SELECT * FROM itemevent WHERE item_id = ?`;
    const values: (string | number)[] = [itemId];
    if (options.title) {
      queryString += ` AND event_title = ?`;
      values.push(options.title);
    }
    return await executeQuery(queryString, values) as ItemEvent[];
  }
  async insertEvents(itemId: number, events: { event_title: string, abstime: number }[], conn?: PoolConnection): Promise<void> {
    if (!events.length) return;
    const queryString = 'INSERT INTO itemevent (item_id, event_title, abstime) VALUES ' + events.map(() => '(?, ?, ?)').join(',');
    const values = events.reduce((acc, event) => ([...acc, itemId, event.event_title, event.abstime]), []);
    await executeQuery(queryString, values, conn);
  }
  async updateEvent(eventId: number, changes: { event_title: string, abstime: number }, conn?: PoolConnection): Promise<void> {
    const { event_title, abstime } = changes;
    const queryString = 'UPDATE itemevent SET event_title = ?, abstime = ? WHERE id = ?';
    await executeQuery(queryString, [event_title, abstime, eventId], conn);
  }
  async deleteEvents(eventIds: number[], conn?: PoolConnection): Promise<void> {
    if (!eventIds.length) return;
    // Un-import deleted events
    await this.deleteImports(null, eventIds);
    const [whereClause, values] = eventIds.reduce((cond, id) => cond.or('id = ?', id), new Cond()).export();
    const queryString = `DELETE FROM itemevent WHERE ${whereClause};`;
    await executeQuery(queryString, values.filter(val => val !== undefined), conn);
  }
  async importEvents(itemId: number, eventIds: number[], conn?: PoolConnection): Promise<void> {
    if (!eventIds.length) return;
    const queryString = 'INSERT INTO timelineitem (timeline_id, event_id) VALUES ' + eventIds.map(() => '(?, ?)').join(',');
    const values = eventIds.reduce((acc, eventId) => ([...acc, itemId, eventId]), []);
    await executeQuery(queryString, values, conn);
  }
  async deleteImports(itemId: number | null, eventIds: number[], conn?: PoolConnection): Promise<void> {
    if (!eventIds.length) return;
    let cond = eventIds.reduce((cond, id) => cond.or('event_id = ?', id), new Cond());
    if (itemId !== null) cond = cond.and('timeline_id = ?', itemId);
    const [whereClause, values] = cond.export();
    const queryString = `DELETE FROM timelineitem WHERE ${whereClause};`;
    await executeQuery(queryString, values.filter(val => val !== undefined), conn);
  }
  async fetchImports(itemId: number): Promise<{ event_id: number, timeline_id: number }[]> {
    const queryString = `SELECT * FROM timelineitem WHERE timeline_id = ?`;
    const values = [itemId];
    return await executeQuery(queryString, values) as { event_id: number, timeline_id: number }[];
  }

  async put(
    user: User | undefined,
    universeShortname: string,
    itemShortname: string,
    changes: { title?: string, shortname?: string, item_type?: string, obj_data?: string, tags?: string[] },
    conn?: PoolConnection
  ): Promise<number> {
    if (!user) throw new UnauthorizedError();
    const { title, shortname, item_type, obj_data, tags } = changes;

    if (!title || !obj_data) throw new ValidationError('Missing required fields');
    const item = await this.getByUniverseAndItemShortnames(user, universeShortname, itemShortname, perms.WRITE);

    const objData = JSON.parse(obj_data);
    await this.handleLinks(item, objData, conn);

    if (tags) {
      const trimmedTags = tags.map(tag => tag[0] === '#' ? tag.substring(1) : tag);

      // If tags list is provided, we can just as well handle it here
      await this.putTags(user, universeShortname, itemShortname, trimmedTags, conn);
      const tagLookup = {};
      item.tags?.forEach(tag => {
        tagLookup[tag] = true;
      });
      trimmedTags.forEach(tag => {
        delete tagLookup[tag];
      });
      await this.delTags(user, universeShortname, itemShortname, Object.keys(tagLookup), conn);
    }

    if (shortname !== null && shortname !== undefined && shortname !== item.shortname) {
      // The item shortname has changed, we need to update all links to it to reflect this
      const shortnameError = this.api.universe.validateShortname(shortname);
      if (shortnameError) throw new ValidationError(shortnameError);
    }

    const doUpdate = async (conn: PoolConnection) => {
      if (shortname !== null && shortname !== undefined && shortname !== item.shortname) {
        await conn.execute('UPDATE itemlink SET to_item_short = ? WHERE to_item_short = ?', [shortname, item.shortname]);
      }

      const queryString = `
        UPDATE item
        SET
          title = ?,
          shortname = ?,
          item_type = ?,
          obj_data = ?,
          updated_at = ?,
          last_updated_by = ?
        WHERE id = ?;
      `;

      await conn.execute(queryString, [title, shortname ?? item.shortname, item_type ?? item.item_type, JSON.stringify(objData), new Date(), user.id, item.id]);

      this.api.universe.putUpdatedAtWithTransaction(conn, item.universe_id, new Date());
    };

    if (conn) {
      await doUpdate(conn);
    } else {
      await withTransaction(doUpdate);
    }

    return item.id;
  }

  async putData(user: User | undefined, universeShortname: string, itemShortname: string, changes): Promise<ResultSetHeader> {
    if (!user) throw new UnauthorizedError();

    const item = await this.getByUniverseAndItemShortnames(user, universeShortname, itemShortname, perms.WRITE);

    item.obj_data = {
      ...JSON.parse(item.obj_data as string),
      ...changes,
    };

    let data!: ResultSetHeader;
    await withTransaction(async (conn) => {
      await this.handleLinks(item, item.obj_data, conn);

      const queryString = `UPDATE item SET obj_data = ?, updated_at = ?, last_updated_by = ? WHERE id = ?;`;
      [data] = await conn.execute<ResultSetHeader>(queryString, [JSON.stringify(item.obj_data), new Date(), user.id, item.id]);
      
      this.api.universe.putUpdatedAtWithTransaction(conn, item.universe_id, new Date());
    });

    return data;
  }

  // TODO - how should permissions work on this?
  async exists(user: User | undefined, universeShortname: string, itemShortname: string): Promise<boolean> {
    const queryString = `
      SELECT 1
      FROM item
      INNER JOIN universe ON universe.id = item.universe_id
      WHERE universe.shortname = ? AND item.shortname = ?;
    `;
    const data = await executeQuery(queryString, [universeShortname, itemShortname]);
    return data.length > 0;
  }


  /**
   * NOT safe. Make sure user has permissions to the item in question before calling this!
   * @param {*} itemShortname 
   * @returns 
   */
  async putLineage(parent_id: number, child_id: number, parent_title: string, child_title: string, conn?: PoolConnection): Promise<ResultSetHeader> {
    const queryString = `INSERT INTO lineage (parent_id, child_id, parent_title, child_title) VALUES (?, ?, ?, ?);`;
    const data = await executeQuery<ResultSetHeader>(queryString, [parent_id, child_id, parent_title, child_title], conn);
    return data;
  }


  /**
   * NOT safe. Make sure user has permissions to the item in question before calling this!
   * @param {*} itemShortname 
   * @returns 
   */
  async delLineage(parent_id: number, child_id: number, conn?: PoolConnection): Promise<ResultSetHeader> {
    const queryString = `DELETE FROM lineage WHERE parent_id = ? AND child_id = ?;`;
    const data = await executeQuery<ResultSetHeader>(queryString, [parent_id, child_id], conn);
    return data;
  }

  async putTags(user: User | undefined, universeShortname: string, itemShortname: string, tags: string[], conn?: PoolConnection): Promise<ResultSetHeader | void> {
    if (tags.length === 0) return; // Nothing to do
    const item = await this.getByUniverseAndItemShortnames(user, universeShortname, itemShortname, perms.WRITE, true);
    const tagLookup = {};
    item.tags?.forEach(tag => {
      tagLookup[tag] = true;
    });
    const filteredTags = tags.filter(tag => !tagLookup[tag]);
    const valueString = filteredTags.map(() => `(?, ?)`).join(',');
    const valueArray = filteredTags.reduce((arr, tag) => [...arr, item.id, tag], []);
    if (!valueString) return;
    const queryString = `INSERT INTO tag (item_id, tag) VALUES ${valueString};`;
    const data = await executeQuery<ResultSetHeader>(queryString, valueArray, conn);
    return data;
  }

  async delTags(user: User | undefined, universeShortname: string, itemShortname: string, tags: string[], conn?: PoolConnection): Promise<ResultSetHeader | void> {
    if (tags.length === 0) return; // Nothing to do
    const item = await this.getByUniverseAndItemShortnames(user, universeShortname, itemShortname, perms.WRITE, true);
    const whereString = tags.map(() => `tag = ?`).join(' OR ');
    if (!whereString) return;
    const queryString = `DELETE FROM tag WHERE item_id = ? AND (${whereString});`;
    const data = await executeQuery<ResultSetHeader>(queryString, [item.id, ...tags], conn);
    return data;
  }

  async snoozeUntil(user: User | undefined, universeShortname: string, itemShortname: string): Promise<ResultSetHeader> {
    if (!user) throw new UnauthorizedError();
    const item = await this.getByUniverseAndItemShortnames(user, universeShortname, itemShortname, perms.WRITE);

    const snooze = (await executeQuery(`SELECT * FROM snooze WHERE item_id = ${item.id} AND snoozed_by = ${user.id};`))[0];

    const now = new Date();

    if (snooze) {
      return await executeQuery<ResultSetHeader>(`UPDATE snooze SET snoozed_at = ? WHERE item_id = ? AND snoozed_by = ?;`, [now, item.id, user.id]);
    } else {
      return await executeQuery<ResultSetHeader>(`INSERT INTO snooze (item_id, snoozed_at, snoozed_by) VALUES (?, ?, ?);`, [item.id, now, user.id]);
    }
  }

  async subscribeNotifs(user: User | undefined, universeShortname: string, itemShortname: string, isSubscribed: boolean): Promise<ResultSetHeader> {
    if (!user) throw new UnauthorizedError();
    const item = await this.getByUniverseAndItemShortnames(user, universeShortname, itemShortname, perms.READ);

    return await executeQuery<ResultSetHeader>(`
        INSERT INTO itemnotification (item_id, user_id, is_enabled) VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE is_enabled = ?
      `, [item.id, user.id, isSubscribed, isSubscribed]);
  }

  async del(user: User | undefined, universeShortname: string, itemShortname: string): Promise<void> {
    const item = await this.getByUniverseAndItemShortnames(user, universeShortname, itemShortname, perms.OWNER, true);

    await withTransaction(async (conn) => {
      await conn.execute(`
          DELETE comment
          FROM comment
          INNER JOIN itemcomment AS ic ON ic.comment_id = comment.id
          WHERE ic.item_id = ?;
        `, [item.id]);
      await conn.execute(`DELETE FROM item WHERE id = ?;`, [item.id]);
    });
  }
}
