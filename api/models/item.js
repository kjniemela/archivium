const { QueryBuilder, Cond, executeQuery, perms } = require('../utils');

async function getOne(user, id, permissionsRequired=perms.READ, basicOnly=false) {

  const conditions = { 
    strings: [
      'item.id = ?',
    ], values: [
      id,
    ]
  };

  const [errCode, data] = await getMany(user, conditions, permissionsRequired, basicOnly);
  if (data) return [errCode];
  const item = data[0];
  if (!item) return [user ? 403 : 401];
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
    .groupBy(['item.id', 'user.username', 'universe.title'])
    if (options.sort) query.orderBy(options.sort, options.sortDesc);
    if (options.limit) query.limit(options.limit);

  return query;
}

async function getMany(user, conditions, permissionsRequired=perms.READ, basicOnly=false, options={}) {
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

  if (options.sort) {
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
      ...(basicOnly ? [] : [
        [`JSON_REMOVE(JSON_OBJECTAGG(
          IFNULL(child_item.shortname, 'null__'),
          JSON_ARRAY(lineage_child.child_title, lineage_child.parent_title)
        ), '$.null__')`, 'children'],
        [`JSON_REMOVE(JSON_OBJECTAGG(
          IFNULL(parent_item.shortname, 'null__'),
          JSON_ARRAY(lineage_parent.parent_title, lineage_parent.child_title)
        ), '$.null__')`, 'parents'],
        [`JSON_REMOVE(JSON_OBJECTAGG(IFNULL(child_item.shortname, 'null__'), child_item.title), '$.null__')`, 'child_titles'],
        [`JSON_REMOVE(JSON_OBJECTAGG(IFNULL(parent_item.shortname, 'null__'), parent_item.title), '$.null__')`, 'parent_titles'],
        [`JSON_ARRAYAGG(JSON_ARRAY(ev.src_shortname, ev.src_title, ev.src_id, ev.event_title, ev.abstime))`, 'events'],
        [`JSON_ARRAYAGG(JSON_ARRAY(itemimage.id, itemimage.name, itemimage.label))`, 'gallery'],
      ]),
      ...(options.select ?? []),
      ...(options.includeData ? ['item.obj_data'] : []),
    ];

    const joins = [
      ...(basicOnly ? [] : [
        ['LEFT', ['lineage', 'lineage_child'], new Cond('lineage_child.parent_id = item.id')],
        ['LEFT', ['lineage', 'lineage_parent'], new Cond('lineage_parent.child_id = item.id')],
        ['LEFT', ['item', 'child_item'], new Cond('child_item.id = lineage_child.child_id')],
        ['LEFT', ['item', 'parent_item'], new Cond('parent_item.id = lineage_parent.parent_id')],
        ['LEFT', `(
            SELECT DISTINCT itemevent.item_id, itemevent.event_title, itemevent.abstime, timelineitem.timeline_id, item.shortname as src_shortname, item.title as src_title, item.id as src_id
            FROM itemevent
            LEFT JOIN timelineitem ON timelineitem.event_id = itemevent.id
            INNER JOIN item ON itemevent.item_id = item.id
            ORDER BY itemevent.abstime DESC
        ) ev`, new Cond('ev.item_id = item.id').or('ev.timeline_id = item.id')],
        ['LEFT', 'itemimage', new Cond('itemimage.item_id = item.id')],
      ]),
      ...(options.join ?? []),
    ]

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
    data.forEach(item => {
      if (!basicOnly) {
        // TODO dumb workarounds for bad SQL query
        item.events = item.events.filter(event => event[0] !== null);
      }
    })
    return [200, data];
  } catch (err) {
    console.error(err);
    return [500];
  }
}

async function getByAuthorUsername(user, username, permissionsRequired, basicOnly, options) {

  const conditions = { 
    strings: [
      'user.username = ?',
    ], values: [
      username,
    ]
  };

  const [errCode, items] = await getMany(user, conditions, permissionsRequired, basicOnly, options);
  if (!items) return [errCode];
  return [200, items];
}

async function getByUniverseId(user, universeId, permissionsRequired, basicOnly, options) {

  const conditions = { 
    strings: [
      'item.universe_id = ?',
    ], values: [
      universeId,
    ]
  };

  const [errCode, items] = await getMany(user, conditions, permissionsRequired, basicOnly, options);
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

async function getByUniverseShortname(user, shortname, permissionsRequired=perms.READ, basicOnly=false, options) {

  const conditions = { 
    strings: [
      'universe.shortname = ?',
    ], values: [
      shortname,
    ]
  };

  const [errCode, items] = await getMany(user, conditions, permissionsRequired, basicOnly, options);
  if (!items) return [errCode];
  return [200, items];
}

async function getByUniverseAndItemShortnames(user, universeShortname, itemShortname, permissionsRequired=perms.READ, basicOnly=false) {

  const conditions = { 
    strings: [
      'universe.shortname = ?',
      'item.shortname = ?',
    ], values: [
      universeShortname,
      itemShortname,
    ]
  };

  const [errCode, data] = await getMany(user, conditions, permissionsRequired, basicOnly, { includeData: true });
  if (!data) return [errCode];
  const item = data[0];
  if (!item) return [user ? 403 : 401];
  return [200, item];
}

async function post(user, body, universeShortName) {

  let universeId;
  try {
    // TODO - ACTUALLY VALIDATE PERMISSIONS HERE!
    universeId = (await executeQuery('SELECT id FROM universe WHERE shortname = ?', [ universeShortName ]))[0]?.id;
    if (universeId === undefined) return [404];
  } catch (err) {
    console.error(err);
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
    console.log(body)
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
    console.error(err);
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
    const [newParents, newChildren] = [{}, {}];
    for (const shortname in lineage.parents ?? {}) {
      const [, parent] = await getByUniverseAndItemShortnames(user, universeShortname, shortname, perms.WRITE);
      if (!parent) return [400];
      newParents[shortname] = true;
      if (!(shortname in item.parents)) {
        [code,] = await putLineage(parent.id, item.id, ...lineage.parents[shortname]);
      }
    }
    for (const shortname in lineage.children ?? {}) {
      const [, child] = await getByUniverseAndItemShortnames(user, universeShortname, shortname, perms.WRITE);
      if (!child) return [400];
      newChildren[shortname] = true;
      if (!(shortname in item.children)) {
        [code, ] = await putLineage(item.id, child.id, ...lineage.children[shortname].reverse());
      }
    }
    for (const shortname in item.parents) {
      if (!newParents[shortname]) {
        const [, parent] = await getByUniverseAndItemShortnames(user, universeShortname, shortname, perms.WRITE);
        delLineage(parent.id, item.id);
      }
    }
    for (const shortname in item.children) {
      if (!newChildren[shortname]) {
        const [, child] = await getByUniverseAndItemShortnames(user, universeShortname, shortname, perms.WRITE);
        delLineage(item.id, child.id);
      }
    }
  }

  // Handle timeline data
  if (timeline) {
    const myEvents = timeline.events.filter(event => !event.imported);
    const myImports = timeline.events.filter(event => event.imported);
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
    console.error(err);
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
    console.error(err);
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
    console.error(e);
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
    console.error(e);
    return [500];
  }
}

async function snoozeUntil(user, universeShortname, itemShortname) {
  const [code, item] = await getByUniverseAndItemShortnames(user, universeShortname, itemShortname, perms.WRITE);
  if (!item) return [code];

  const snooze = (await executeQuery(`SELECT * FROM snooze WHERE item_id = ${item.id} AND snoozed_by = ${user.id};`))[0];

  const now = new Date();
  const snoozeTime = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  try {
    if (snooze) {
      return [200, await executeQuery(`UPDATE snooze SET snoozed_until = ? WHERE item_id = ? AND snoozed_by = ?;`, [snoozeTime, item.id, user.id])];
    } else {
      return [200, await executeQuery(`INSERT INTO snooze (item_id, snoozed_until, snoozed_by) VALUES (?, ?, ?);`, [item.id, snoozeTime, user.id])];
    }
  } catch (err) {
    console.error(err);
    return [500];
  }
}

module.exports = {
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