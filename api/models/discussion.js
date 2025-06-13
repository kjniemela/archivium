const { executeQuery, parseData, perms, getPfpUrl, withTransaction } = require('../utils');
const logger = require('../../logger');

let api;
function setApi(_api) {
  api = _api;
}

async function getThreads(user, options, canPost=false, includeExtra=false) {
  try {
    const parsedOptions = parseData(options);
    const filter = user
      ? (canPost
        ? `
          (universe.public = 1 AND universe.discussion_open)
          OR (au_filter.user_id = ${user.id} AND (
            (au_filter.permission_level >= ${perms.READ} AND universe.discussion_open)
            OR au_filter.permission_level >= ${perms.COMMENT}
          ))
        `
        : `
          universe.public = 1 OR (au_filter.user_id = ${user.id} AND au_filter.permission_level >= ${perms.READ})
        `)
      : 'universe.public = 1';
    const conditionString = options ? `AND ${parsedOptions.strings.join(' AND ')}` : '';
    const queryString = `
      SELECT
        ${includeExtra ? 'comments.*,' : ''}
        ${user ? 'tn.is_enabled AS notifs_enabled,' : ''}
        discussion.*,
        universe.shortname AS universe_short
      FROM discussion
      INNER JOIN universe ON universe.id = discussion.universe_id
      INNER JOIN authoruniverse as au_filter
        ON universe.id = au_filter.universe_id AND (
          ${filter}
        )
      LEFT JOIN authoruniverse as au ON universe.id = au.universe_id
      ${includeExtra ? `
        LEFT JOIN (
          SELECT DISTINCT
            COUNT(comment.id) as comment_count,
            MIN(comment.created_at) as first_activity,
            MAX(comment.created_at) as last_activity,
            tc.thread_id
          FROM comment
          INNER JOIN threadcomment AS tc ON tc.comment_id = comment.id
          GROUP BY thread_id
        ) comments ON comments.thread_id = discussion.id
      ` : ''}
      ${user ? `
        LEFT JOIN threadnotification AS tn ON tn.thread_id = discussion.id AND tn.user_id = ${user.id}
      ` : ''}
      WHERE universe.discussion_enabled
      ${conditionString}
      GROUP BY discussion.id;`;
    const data = await executeQuery(queryString, options && parsedOptions.values);
    return [200, data];
  } catch (err) {
    logger.error(err);
    return [500];
  }
}

async function getCommentsByThread(user, threadId, validate=true, inclCommenters=false) {
  try {
    if (validate) {
      const [code, threads] = await getThreads(user, { 'discussion.id': threadId });
      const thread = threads[0];
      if (!thread) return [code];
    }
    const queryString1 = `
      SELECT comment.*
      FROM comment
      INNER JOIN threadcomment AS tc ON tc.comment_id = comment.id
      WHERE tc.thread_id = ?`;
    const comments = await executeQuery(queryString1, [ threadId ]);
    if (inclCommenters) {
      const queryString2 = `
        SELECT user.id, user.username, user.email, (ui.user_id IS NOT NULL) as hasPfp
        FROM user
        INNER JOIN comment ON user.id = comment.author_id
        INNER JOIN threadcomment AS tc ON tc.comment_id = comment.id
        LEFT JOIN userimage AS ui ON user.id = ui.user_id
        WHERE tc.thread_id = ?
        GROUP BY user.id`;
      const users = await executeQuery(queryString2, [ threadId ]);
      return [200, comments, users];
    }
    return [200, comments];
  } catch (err) {
    logger.error(err);
    return [500];
  }
}

/**
 * This assumes you have already validated access to the item!
 * @param {*} itemId 
 * @param {*} inclCommenters 
 * @returns 
 */
async function getCommentsByItem(itemId, inclCommenters=false) {
  try {
    const queryString1 = `
      SELECT comment.*
      FROM comment
      INNER JOIN itemcomment AS ic ON ic.comment_id = comment.id
      WHERE ic.item_id = ?`;
    const comments = await executeQuery(queryString1, [ itemId ]);
    if (inclCommenters) {
      const queryString2 = `
        SELECT user.id, user.username, user.email
        FROM user
        INNER JOIN comment ON user.id = comment.author_id
        INNER JOIN itemcomment AS ic ON ic.comment_id = comment.id
        WHERE ic.item_id = ?
        GROUP BY user.id`;
      const users = await executeQuery(queryString2, [ itemId ]);
      return [200, comments, users];
    }
    return [200, comments];
  } catch (err) {
    logger.error(err);
    return [500];
  }
}

/**
 * This assumes you have already validated access to the chapter!
 * @param {*} chapterId 
 * @param {*} inclCommenters 
 * @returns 
 */
async function getCommentsByChapter(chapterId, inclCommenters=false) {
  try {
    const queryString1 = `
      SELECT comment.*
      FROM comment
      INNER JOIN storychaptercomment AS scc ON scc.comment_id = comment.id
      WHERE scc.chapter_id = ?`;
    const comments = await executeQuery(queryString1, [ chapterId ]);
    if (inclCommenters) {
      const queryString2 = `
        SELECT user.id, user.username, user.email
        FROM user
        INNER JOIN comment ON user.id = comment.author_id
        INNER JOIN storychaptercomment AS scc ON scc.comment_id = comment.id
        WHERE scc.chapter_id = ?
        GROUP BY user.id`;
      const users = await executeQuery(queryString2, [ chapterId ]);
      return [200, comments, users];
    }
    return [200, comments];
  } catch (err) {
    logger.error(err);
    return [500];
  }
}

async function postUniverseThread(user, universeShortname, { title }) {
  const [code, universe] = await api.universe.getOne(user, { shortname: universeShortname }, perms.READ);
  if (!universe) return [code];
  if (!universe.discussion_enabled) return [403];
  if (!universe.discussion_open && universe.author_permissions[user.id] < perms.COMMENT) return [403];
  if (!title) return [400, 'Title is required for universe discussion threads.'];

  try {
    const queryString = `INSERT INTO discussion (title, universe_id) VALUES (?, ?);`;
    const data = await executeQuery(queryString, [ title, universe.id ]);
    return [201, data];
  } catch (err) {
    logger.error(err);
    return [500];
  }
}

async function forEachUserToNotify(thread, callback) {
  const targetIDs = (await executeQuery(`SELECT user_id FROM threadnotification WHERE thread_id = ? AND is_enabled`, [ thread.id ])).map(row => row.user_id);
  for (const userID of targetIDs) {
    const [_, user] = await api.user.getOne({ 'user.id': userID });
    if (user) {
      callback(user);
    }
  }
}

async function postCommentToThread(user, threadId, { body, reply_to }) {
  const [code, threads] = await getThreads(user, { 'discussion.id': threadId }, true);
  const thread = threads[0];
  if (!thread) return [code];
  if (!body) return [400];

  try {
    let data;
    await withTransaction(async (conn) => {
      const queryString1 = `INSERT INTO comment (body, author_id, reply_to, created_at) VALUES (?, ?, ?, ?);`;
      [ data ] = await conn.execute(queryString1, [ body, user.id, reply_to ?? null, new Date() ]);
      const queryString2 = `INSERT INTO threadcomment (thread_id, comment_id) VALUES (?, ?)`;
      await conn.execute(queryString2, [ thread.id, data.insertId ])
    });

    forEachUserToNotify(thread, async (target) => {
      if (target.id === user.id) return;
      await api.notification.notify(target, api.notification.types.COMMENTS, {
        title: `${user.username} commented in ${thread.title}:`,
        body: body,
        icon: getPfpUrl(user),
        clickUrl: `/universes/${thread.universe_short}/discuss/${thread.id}`,
      });
    })

    return [201, data];
  } catch (err) {
    logger.error(err);
    return [500];
  }
}

async function postCommentToItem(user, universeShortname, itemShortname, { body, reply_to }) {
  const [code1, universe] = await api.universe.getOne(user, { shortname: universeShortname }, perms.READ);
  if (!universe) return [code1];
  if (!universe.discussion_enabled) return [403];
  const [code2, item] = await api.item.getByUniverseAndItemShortnames(
    user,
    universeShortname,
    itemShortname,
    universe.discussion_open ? perms.READ : perms.COMMENT,
    true,
  );
  if (!item) return [code2];
  if (!body) return [400];

  try {
    let data;
    await withTransaction(async (conn) => {
      const queryString1 = `INSERT INTO comment (body, author_id, reply_to, created_at) VALUES (?, ?, ?, ?);`;
      [ data ] = await conn.execute(queryString1, [ body, user.id, reply_to ?? null, new Date() ]);
      const queryString2 = `INSERT INTO itemcomment (item_id, comment_id) VALUES (?, ?)`;
      await conn.execute(queryString2, [ item.id, data.insertId ]);
    });

    await api.item.forEachUserToNotify(item, async (target) => {
      if (target.id === user.id) return;
      await api.notification.notify(target, api.notification.types.COMMENTS, {
        title: `${user.username} commented on ${item.title}:`,
        body: body,
        icon: getPfpUrl(user),
        clickUrl: `/universes/${universeShortname}/items/${itemShortname}`,
      });
    })

    return [201, data];
  } catch (err) {
    logger.error(err);
    return [500];
  }
}
async function postCommentToChapter(user, shortname, index, { body, reply_to }) {
  const [code1, story] = await api.story.getOne(user, { 'story.shortname': shortname });
  if (!story) return [code1];
  const [code2, chapter] = await api.story.getChapter(user, shortname, index);
  if (!chapter) return [code2];
  if (!chapter.is_published) return [403];
  if (!body) return [400];

  try {
    let data;
    await withTransaction(async (conn) => {
      const queryString1 = `INSERT INTO comment (body, author_id, reply_to, created_at) VALUES (?, ?, ?, ?);`;
      [ data ] = await conn.execute(queryString1, [ body, user.id, reply_to ?? null, new Date() ]);
      const queryString2 = `INSERT INTO storychaptercomment (chapter_id, comment_id) VALUES (?, ?)`;
      await conn.execute(queryString2, [ chapter.id, data.insertId ]);
    });

    if (user.id !== story.author_id) {
      const [, target] = await api.user.getOne({ id: story.author_id });
      if (target) {
        await api.notification.notify(target, api.notification.types.COMMENTS, {
          title: `${user.username} commented on ${chapter.title} of ${story.title}:`,
          body: body,
          icon: getPfpUrl(user),
          clickUrl: `/stories/${story.shortname}/${chapter.chapter_number}`,
        });
      }
    }

    return [201, data];
  } catch (err) {
    logger.error(err);
    return [500];
  }
}

async function subscribeToThread(user, threadId, isSubscribed) {
  if (!user) return [401];
  const [code, threads] = await getThreads(user, { 'discussion.id': threadId }, true);
  const thread = threads[0];
  if (!thread) return [code];

  try {
    return [200, await executeQuery(`
      INSERT INTO threadnotification (thread_id, user_id, is_enabled) VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE is_enabled = ?
    `, [thread.id, user.id, isSubscribed, isSubscribed])];
  } catch (err) {
    logger.error(err);
    return [500];
  }
}

async function deleteThreadComment(user, threadId, commentId) {
  if (!user) return [401];
  const [code, threads] = await getThreads(user, { 'discussion.id': threadId });
  const thread = threads[0];
  if (!thread) return [code];

  try {
    const comment = (await executeQuery(`
      SELECT comment.*
      FROM comment
      INNER JOIN threadcomment AS tc ON tc.comment_id = comment.id
      WHERE tc.thread_id = ? AND comment.id = ?
    `, [thread.id, commentId]))[0];
    if (comment.author_id !== user.id) {
      const [code, universe] = await api.universe.getOne(user, { 'universe.shortname': thread.universe_short }, perms.ADMIN);
      if (!universe) return [code];
    }

    await executeQuery('UPDATE comment SET body = NULL, author_id = NULL WHERE id = ?', [commentId]);
    return [200];
  } catch (err) {
    logger.error(err);
    return [500];
  }
}

async function deleteItemComment(user, universeShortname, itemShortname, commentId) {
  const [code, item] = await api.item.getByUniverseAndItemShortnames(
    user,
    universeShortname,
    itemShortname,
    perms.READ,
    true,
  );
  if (!item) return [code];

  try {
    const comment = (await executeQuery(`
      SELECT comment.*
      FROM comment
      INNER JOIN itemcomment AS ic ON ic.comment_id = comment.id
      WHERE ic.item_id = ? AND comment.id = ?
    `, [item.id, commentId]))[0];
    if (comment.author_id !== user.id) {
      const [code, universe] = await api.universe.getOne(user, { 'universe.shortname': item.universe_short }, perms.ADMIN);
      if (!universe) return [code];
    }

    await executeQuery('UPDATE comment SET body = NULL, author_id = NULL WHERE id = ?', [commentId]);
    return [200];
  } catch (err) {
    logger.error(err);
    return [500];
  }
}

module.exports = {
  setApi,
  getThreads,
  getCommentsByThread,
  getCommentsByItem,
  getCommentsByChapter,
  postUniverseThread,
  postCommentToThread,
  postCommentToItem,
  postCommentToChapter,
  subscribeToThread,
  deleteThreadComment,
  deleteItemComment,
};
