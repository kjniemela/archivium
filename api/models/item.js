const { QueryBuilder, Cond, executeQuery, parseData, perms } = require('../utils');
const logger = require('../../logger');

async function getOne(user, conditions, permissionsRequired=perms.READ, basicOnly=false, options={}) {

  const parsedConditions = parseData(conditions);

  const [errCode, data] = await getMany(user, parsedConditions, permissionsRequired, { ...options, limit: 1 });
  if (!data) return [errCode];
  const item = data[0];
  if (!item) return [user ? 403 : 401];

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
  }

  return [200, item];
}

function getQuery(selects=[], permsCond=undefined, whereConds=undefined, options={}) {
  let query = new QueryBuilder()
    .select([
      'item.id',
      'item.title',
      'item.shortname',
      'item.item_type',
      'item.created_at',
      'item.updated_at',
      'item.universe_id',
      ['user.username', 'author'],
      ['universe.title', 'universe'],
      ['universe.shortname', 'universe_short'],
      ...selects,
      'tag.tags',
    ])
    .from('item')
    .innerJoin('user', new Cond('user.id = item.author_id'))
    .innerJoin('universe', new Cond('universe.id = item.universe_id'))
    .innerJoin(['authoruniverse', 'au_filter'], new Cond('universe.id = au_filter.universe_id').and(permsCond))
    .leftJoin(`(
      SELECT item_id, JSON_ARRAYAGG(tag) as tags
      FROM tag
      GROUP BY item_id
    ) tag`, new Cond('tag.item_id = item.id'))
    .where(whereConds)
    .groupBy(['item.id', 'user.username', 'universe.title', ...(options.groupBy ?? [])]);
  if (options.sort) query.orderBy(options.sort, options.sortDesc);
  if (options.limit) query.limit(options.limit);

  return query;
}

async function getMany(user, conditions, permissionsRequired=perms.READ, options={}) {
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

  if (options.sort && !options.forceSort) {
    const validSorts = { 'title': true, 'created_at': true, 'updated_at': true, 'author': true, 'item_type': true };
    if (!validSorts[options.sort]) {
      delete options.sort;
    }
  }

  try {
    let permsCond = new Cond();
    if (permissionsRequired <= perms.READ) permsCond = permsCond.or('universe.public = ?', 1);
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

    const selects = [
      ...(options.select ?? []),
      ...(options.includeData ? ['item.obj_data'] : []),
    ];

    const joins = [
      ...(options.join ?? []),
    ];

    let data;
    if (options.search) {
      const query = new QueryBuilder().union(
        getQuery(
          selects,
          permsCond,
          whereConds.and('item.title LIKE ?', `%${options.search}%`),
          options,
        )
      ).union(
        getQuery(
          selects,
          permsCond,
          whereConds.and('item.shortname LIKE ?', `%${options.search}%`),
          options,
        )
      ).union(
        getQuery(
          selects,
          permsCond,
          whereConds.and('search_tag.tag = ?', options.search),
          options,
        ).innerJoin(['tag', 'search_tag'], new Cond('search_tag.item_id = item.id'))
      ).union(
        getQuery(
          selects,
          permsCond,
          whereConds.and('search_tag.tag LIKE ?', `%${options.search}%`),
          options,
        ).innerJoin(['tag', 'search_tag'], new Cond('search_tag.item_id = item.id'))
      );
      data = await query.execute();
    } else {
      const query = getQuery(selects, permsCond, whereConds, options);
      for (const join of joins) {
        query.join(...join);
      }
      data = await query.execute();
    }

    return [200, data];
  } catch (err) {
    logger.error(err);
    return [500];
  }
}

async function getByAuthorUsername(user, username, permissionsRequired, options) {

  const conditions = { 
    strings: [
      'user.username = ?',
    ], values: [
      username,
    ]
  };

  const [errCode, items] = await getMany(user, conditions, permissionsRequired, options);
  if (!items) return [errCode];
  return [200, items];
}

async function getByUniverseId(user, universeId, permissionsRequired, options) {

  const conditions = { 
    strings: [
      'item.universe_id = ?',
    ], values: [
      universeId,
    ]
  };

  const [errCode, items] = await getMany(user, conditions, permissionsRequired, options);
  if (!items) return [errCode];
  return [200, items];
}

async function getByUniverseAndItemIds(user, universeId, itemId, permissionsRequired=perms.READ) {

  const conditions = { 
    strings: [
      'item.universe_id = ?',
      'item.id = ?',
    ], values: [
      universeId,
      itemId,
    ]
  };

  const [errCode, data] = await getMany(user, conditions, permissionsRequired);
  if (!data) return [errCode];
  const item = data[0];
  if (!item) return [user ? 403 : 401];
  return [200, item];
}

async function getByUniverseShortname(user, shortname, permissionsRequired=perms.READ, options) {

  const conditions = { 
    strings: [
      'universe.shortname = ?',
    ], values: [
      shortname,
    ]
  };

  const [errCode, items] = await getMany(user, conditions, permissionsRequired, options);
  if (!items) return [errCode];
  return [200, items];
}

async function getByUniverseAndItemShortnames(user, universeShortname, itemShortname, permissionsRequired=perms.READ, basicOnly=false) {

  const conditions = { 
    'universe.shortname': universeShortname,
    'item.shortname': itemShortname,
  };

  return await getOne(user, conditions, permissionsRequired, basicOnly, { includeData: true });
}

async function post(user, body, universeShortName) {

  let universeId;
  try {
    // TODO - ACTUALLY VALIDATE PERMISSIONS HERE!
    universeId = (await executeQuery('SELECT id FROM universe WHERE shortname = ?', [ universeShortName ]))[0]?.id;
    if (universeId === undefined) return [404];
  } catch (err) {
    logger.error(err);
    return [500];
  }

  try {
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
    const { title, shortname, item_type, parent_id, obj_data } = body;
    if (!title || !shortname || !item_type || !obj_data) return [400];
    return [201, await executeQuery(queryString, [
      title,
      shortname,
      item_type,
      user.id,
      universeId,
      parent_id ?? null,
      obj_data,
      new Date(),
      new Date(),
    ])];
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return [400, 'item.shortname must be unique within each universe.'];
    logger.error(err);
    return [500];
  }
}

async function save(user, universeShortname, itemShortname, body, jsonMode=false) {
  // Handle tags
  if (!jsonMode) body.tags = body.tags?.split(' ') ?? [];

  // Handle obj_data
  if (!('obj_data' in body)) {
    return [400]; // We should probably render an error on the edit page instead here.
  }
  if (!jsonMode) body.obj_data = JSON.parse(decodeURIComponent(body.obj_data));
  let lineage;
  if ('lineage' in body.obj_data) {
    lineage = body.obj_data.lineage;
    body.obj_data.lineage = { title: lineage.title };
  }
  let timeline;
  if ('timeline' in body.obj_data) {
    timeline = body.obj_data.timeline;
    body.obj_data.timeline = { title: timeline.title };
  }
  let gallery;
  if ('gallery' in body.obj_data) {
    gallery = body.obj_data.gallery;
    body.obj_data.gallery = { title: gallery.title };
  }
  let code; let data;
  body.obj_data = JSON.stringify(body.obj_data);

  // Actually save item
  [code, data] = await put(user, universeShortname, itemShortname, body);
  if (code !== 200) {
    return [code, data];
  }

  const [itemCode, item] = await getByUniverseAndItemShortnames(user, universeShortname, itemShortname, perms.WRITE);
  if (!item) return [itemCode];

  // Handle lineage data
  if (lineage) {
    const [existingParents, existingChildren] = [{}, {}];
    for (const { parent_shortname } of item.parents) existingParents[parent_shortname] = true;
    for (const { child_shortname } of item.children) existingChildren[child_shortname] = true;
    const [newParents, newChildren] = [{}, {}];
    for (const shortname in lineage.parents ?? {}) {
      const [, parent] = await getByUniverseAndItemShortnames(user, universeShortname, shortname, perms.WRITE);
      if (!parent) return [400];
      newParents[shortname] = true;
      if (!(shortname in existingParents)) {
        [code,] = await putLineage(parent.id, item.id, ...lineage.parents[shortname]);
      }
    }
    for (const shortname in lineage.children ?? {}) {
      const [, child] = await getByUniverseAndItemShortnames(user, universeShortname, shortname, perms.WRITE);
      if (!child) return [400];
      newChildren[shortname] = true;
      if (!(shortname in existingChildren)) {
        [code, ] = await putLineage(item.id, child.id, ...lineage.children[shortname].reverse());
      }
    }
    for (const { parent_shortname } of item.parents) {
      if (!newParents[parent_shortname]) {
        const [, parent] = await getByUniverseAndItemShortnames(user, universeShortname, parent_shortname, perms.WRITE);
        delLineage(parent.id, item.id);
      }
    }
    for (const { child_shortname } of item.children) {
      if (!newChildren[child_shortname]) {
        const [, child] = await getByUniverseAndItemShortnames(user, universeShortname, child_shortname, perms.WRITE);
        delLineage(item.id, child.id);
      }
    }
  }

  // Handle timeline data
  if (timeline) {
    const myEvents = timeline.events?.filter(event => !event.imported);
    const myImports = timeline.events?.filter(event => event.imported);
    if (myEvents) {
      const events = await fetchEvents(item.id);
      const existingEvents = events.reduce((acc, event) => ({...acc, [event.event_title ?? null]: event}), {});
      const newEvents = myEvents.filter(event => !existingEvents[event.title]);
      const updatedEvents = myEvents.filter(event => existingEvents[event.title] && (
        existingEvents[event.title].event_title !== event.title
        || existingEvents[event.title].abstime !== event.time
      )).map(({ title, time }) => ({ event_title: title, abstime: time, id: existingEvents[title].id }));
      const newEventMap = myEvents.reduce((acc, event) => ({...acc, [event.title ?? null]: true}), {});
      const deletedEvents = events.filter(event => !newEventMap[event.event_title]).map(event => event.id);
      insertEvents(item.id, newEvents);
      for (const event of updatedEvents) {
        updateEvent(event.id, event);
      }
      deleteEvents(deletedEvents);
    }

    if (myImports) {
      const imports = await fetchImports(item.id);
      const existingImports = imports.reduce((acc, ti) => ({...acc, [ti.event_id]: ti}), {});
      const newImports = [];
      const importsMap = {};
      for (const { srcId: itemId, title: eventTitle } of myImports) {
        const event = (await fetchEvents(itemId, { title: eventTitle }))[0];
        if (!event) continue;
        if (!(event.id in existingImports)) {
          newImports.push(event.id);
        }
        importsMap[event.id] = true;
      }
      const deletedImports = imports.filter(ti => !importsMap[ti.event_id]).map(ti => ti.event_id);
      importEvents(item.id, newImports);
      deleteImports(item.id, deletedImports);
    }
  }

  if (gallery) {
    const [_, existingImages] = await image.getManyByItemShort(user, universeShortname, itemShortname);
    const oldImages = {};
    const newImages = {};
    for (const img of existingImages) {
      oldImages[img.id] = img;
    }
    for (const img of gallery.imgs) {
      newImages[img.id] = img;
      if (oldImages[img.id] && img.label !== oldImages[img.id].label) {
        await image.putLabel(user, img.id, img.label);
      }
    }
    for (const img of existingImages) {
      if (!newImages[img.id]) await image.del(user, img.id);
    }
  }

  return [200];
}

async function fetchEvents(itemId, options={}) {
  let queryString = `SELECT * FROM itemevent WHERE item_id = ?`;
  const values = [itemId];
  if (options.title) {
    queryString += ` AND event_title = ?`;
    values.push(options.title);
  }
  return await executeQuery(queryString, values);
}
async function insertEvents(itemId, events) {
  if (!events.length) return;
  const queryString = 'INSERT INTO itemevent (item_id, event_title, abstime) VALUES ' + events.map(() => '(?, ?, ?)').join(',');
  const values = events.reduce((acc, event) => ([ ...acc, itemId, event.title, event.time ]), []);
  return await executeQuery(queryString, values);
}
async function updateEvent(eventId, changes) {
  const { event_title, abstime } = changes;
  const queryString = 'UPDATE itemevent SET event_title = ?, abstime = ? WHERE id = ?';
  return await executeQuery(queryString, [event_title, abstime, eventId]);
}
async function deleteEvents(eventIds) {
  if (!eventIds.length) return;
  const [whereClause, values] = eventIds.reduce((cond, id) => cond.or('id = ?', id), new Cond()).export()
  const queryString = `DELETE FROM itemevent WHERE ${whereClause};`;
  return await executeQuery(queryString, values.filter(val => val !== undefined));
}
async function importEvents(itemId, eventIds) {
  if (!eventIds.length) return;
  const queryString = 'INSERT INTO timelineitem (timeline_id, event_id) VALUES ' + eventIds.map(() => '(?, ?)').join(',');
  const values = eventIds.reduce((acc, eventId) => ([ ...acc, itemId, eventId ]), []);
  return await executeQuery(queryString, values);
}
async function deleteImports(itemId, eventIds) {
  if (!eventIds.length) return;
  const cond = eventIds.reduce((cond, id) => cond.or('event_id = ?', id), new Cond());
  const [whereClause, values] = cond.and('timeline_id = ?', itemId).export();
  const queryString = `DELETE FROM timelineitem WHERE ${whereClause};`;
  return await executeQuery(queryString, values.filter(val => val !== undefined));
}
async function fetchImports(itemId) {
  const queryString = `SELECT * FROM timelineitem WHERE timeline_id = ?`;
  const values = [itemId];
  return await executeQuery(queryString, values);
}

async function put(user, universeShortname, itemShortname, changes) {
  const { title, obj_data, tags } = changes;

  if (!title || !obj_data) return [400];
  const [code, item] = await getByUniverseAndItemShortnames(user, universeShortname, itemShortname, perms.WRITE);
  if (!item) return [code];

  if (tags) {
    // If tags list is provided, we can just as well handle it here
    putTags(user, universeShortname, itemShortname, tags);
    const tagLookup = {};
    item.tags?.forEach(tag => {
      tagLookup[tag] = true;
    });
    tags.forEach(tag => {
      delete tagLookup[tag];
    });
    delTags(user, universeShortname, itemShortname, Object.keys(tagLookup));
  }

  try {
    const queryString = `
      UPDATE item
      SET
        title = ?,
        obj_data = ?,
        updated_at = ?,
        last_updated_by = ?
      WHERE id = ?;
    `;
    return [200, await executeQuery(queryString, [ title, obj_data, new Date(), user.id, item.id ])];
  } catch (err) {
    logger.error(err);
    return [500];
  }
}

async function putData(user, universeShortname, itemShortname, changes) {

  const [code, item] = await getByUniverseAndItemShortnames(user, universeShortname, itemShortname, perms.WRITE);
  if (!item) return [code];

  item.obj_data = {
    ...JSON.parse(item.obj_data),
    ...changes,
  };

  try {
    const queryString = `UPDATE item SET obj_data = ?, updated_at = ?, last_updated_by = ? WHERE id = ?;`;
    return [200, await executeQuery(queryString, [JSON.stringify(item.obj_data), new Date(), user.id, item.id])];
  } catch (err) {
    logger.error(err);
    return [500];
  }
}

// TODO - how should permissions work on this?
async function exists(user, universeShortname, itemShortname) {
  const queryString = `
    SELECT 1
    FROM item
    INNER JOIN universe ON universe.id = item.universe_id
    WHERE universe.shortname = ? AND item.shortname = ?;
  `;
  const data = await executeQuery(queryString, [universeShortname, itemShortname]);
  return [200, data.length > 0];
}


/**
 * NOT safe. Make sure user has permissions to the item in question before calling this!
 * @param {*} itemShortname 
 * @returns 
 */
async function putLineage(parent_id, child_id, parent_title, child_title) {
  const queryString = `INSERT INTO lineage (parent_id, child_id, parent_title, child_title) VALUES (?, ?, ?, ?);`;
  const data = await executeQuery(queryString, [ parent_id, child_id, parent_title, child_title ]);
  return [200, data];
}


/**
 * NOT safe. Make sure user has permissions to the item in question before calling this!
 * @param {*} itemShortname 
 * @returns 
 */
async function delLineage(parent_id, child_id) {
  const queryString = `DELETE FROM lineage WHERE parent_id = ? AND child_id = ?;`;
  const data = await executeQuery(queryString, [ parent_id, child_id, ]);
  return [200, data];
}

async function putTags(user, universeShortname, itemShortname, tags) {
  if (!tags || tags.length === 0) return [400];
  const [code, item] = await getByUniverseAndItemShortnames(user, universeShortname, itemShortname, perms.WRITE, true);
  if (!item) return [code];
  try {
    const tagLookup = {};
    item.tags?.forEach(tag => {
      tagLookup[tag] = true;
    });
    const filteredTags = tags.filter(tag => !tagLookup[tag]);
    const valueString = filteredTags.map(() => `(?, ?)`).join(',');
    const valueArray = filteredTags.reduce((arr, tag) => [...arr, item.id, tag], []);
    if (!valueString) return [200];
    const queryString = `INSERT INTO tag (item_id, tag) VALUES ${valueString};`;
    const data = await executeQuery(queryString, valueArray);
    return [201, data];
  } catch (e) {
    logger.error(e);
    return [500];
  }
}

async function delTags(user, universeShortname, itemShortname, tags) {
  if (!tags || tags.length === 0) return [400];
  const [code, item] = await getByUniverseAndItemShortnames(user, universeShortname, itemShortname, perms.WRITE, true);
  if (!item) return [code];
  try {
    const whereString = tags.map(() => `tag = ?`).join(' OR ');
    if (!whereString) return [200];
    const queryString = `DELETE FROM tag WHERE item_id = ? AND (${whereString});`;
    const data = await executeQuery(queryString, [ item.id, ...tags ]);
    return [200, data];
  } catch (e) {
    logger.error(e);
    return [500];
  }
}

async function snoozeUntil(user, universeShortname, itemShortname) {
  const [code, item] = await getByUniverseAndItemShortnames(user, universeShortname, itemShortname, perms.WRITE);
  if (!item) return [code];

  const snooze = (await executeQuery(`SELECT * FROM snooze WHERE item_id = ${item.id} AND snoozed_by = ${user.id};`))[0];

  const now = new Date();

  try {
    if (snooze) {
      return [200, await executeQuery(`UPDATE snooze SET snoozed_at = ? WHERE item_id = ? AND snoozed_by = ?;`, [now, item.id, user.id])];
    } else {
      return [200, await executeQuery(`INSERT INTO snooze (item_id, snoozed_at, snoozed_by) VALUES (?, ?, ?);`, [item.id, now, user.id])];
    }
  } catch (err) {
    logger.error(err);
    return [500];
  }
}

const image = (function() {
  async function getOneByItemShort(user, universeShortname, itemShortname, options) {
    const [code1, item] = await getByUniverseAndItemShortnames(user, universeShortname, itemShortname, perms.READ, true);
    if (!item) return [code1];
    const [code2, data] = await getMany({ item_id: item.id, ...(options ?? {}) });
    if (code2 !== 200) return [code2];
    const image = data[0];
    if (!image) return [404];
    return [200, image];
  }

  async function getMany(options, inclData=true) {
    try {
      const parsedOptions = parseData(options);
      let queryString = `
        SELECT 
          id, item_id, name, mimetype, label ${inclData ? ', data' : ''}
        FROM itemimage
      `;
      if (options) queryString += ` WHERE ${parsedOptions.strings.join(' AND ')}`;
      const images = await executeQuery(queryString, parsedOptions.values);
      return [200, images];
    } catch (err) {
      logger.error(err);
      return [500];
    }
  }

  async function getManyByItemShort(user, universeShortname, itemShortname, options, inclData=false) {
    const [code1, item] = await getByUniverseAndItemShortnames(user, universeShortname, itemShortname, perms.READ, true);
    if (!item) return [code1];
    const [code2, images] = await getMany({ item_id: item.id, ...(options ?? {}) }, inclData);
    if (code2 !== 200) return [code2];
    return [200, images];
  }

  async function post(user, file, universeShortname, itemShortname) {
    if (!file) return [400];
    if (!user) return [401];

    const { originalname, buffer, mimetype } = file;
    const [code, item] = await getByUniverseAndItemShortnames(user, universeShortname, itemShortname, perms.WRITE, true);
    if (!item) return [code];

    const queryString = `INSERT INTO itemimage (item_id, name, mimetype, data, label) VALUES (?, ?, ?, ?, ?);`;
    return [201, await executeQuery(queryString, [ item.id, originalname, mimetype, buffer, '' ])];
  }

  async function putLabel(user, imageId, label) {
    try {
      if (!user) return [401];
      const [code1, images] = (await getMany({ id: imageId }, false));
      const image = images[0];
      if (!image) return [code1];
      const [code2, item] = await getOne(user, { 'item.id': image.item_id });
      if (!item) return [code2];
      return [200, await executeQuery(`UPDATE itemimage SET label = ? WHERE id = ?;`, [label, imageId])];
    } catch (err) {
      logger.error(err);
      return [500];
    }
  }

  async function del(user, imageId) {
    try {
      if (!user) return [401];
      const [code1, images] = (await getMany({ id: imageId }, false));
      const image = images[0];
      if (!image) return [code1];
      const [code2, item] = await getOne(user, { 'item.id': image.item_id });
      if (!item) return [code2];
      return [200, await executeQuery(`DELETE FROM itemimage WHERE id = ?;`, [imageId])];
    } catch (err) {
      logger.error(err);
      return [500];
    }
  }

  return {
    getOneByItemShort,
    getMany,
    getManyByItemShort,
    post,
    putLabel,
    del,
  };
})();

module.exports = {
  image,
  getOne,
  getMany,
  getByAuthorUsername,
  getByUniverseId,
  getByUniverseAndItemIds,
  getByUniverseShortname,
  getByUniverseAndItemShortnames,
  post,
  save,
  put,
  putData,
  exists,
  putLineage,
  delLineage,
  putTags,
  delTags,
  snoozeUntil,
};