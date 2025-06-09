const { executeQuery, parseData, perms, withTransaction } = require('../utils');
const logger = require('../../logger');

let api;
function setApi(_api) {
  api = _api;
}

const visibilityModes = {
  PRIVATE: 0,
  UNIVERSE: 1,
  PUBLIC: 2,
};

async function getOne(user, conditions, permissionsRequired=perms.READ, options={}) {
  const [code, stories] = await getMany(user, conditions, permissionsRequired, options);
  if (!stories) return [code];
  const story = stories[0];
  if (!story) return [404];
  return [200, story];
}

async function getMany(user, conditions, permissionsRequired=perms.READ, options={}) {
  if (permissionsRequired >= perms.WRITE) {
    conditions = {
      ...(conditions ?? {}),
      'story.author_id': user.id,
    };
  }

  const parsedConditions = parseData(conditions);
  const conditionString = conditions ? `AND ${parsedConditions.strings.join(' AND ')}` : '';

  if (options.sort && !options.forceSort) {
    const validSorts = { 'title': true, 'created_at': true, 'updated_at': true, 'author': true };
    if (!validSorts[options.sort]) {
      delete options.sort;
    }
  }

  try {
    const stories = await executeQuery(`
      SELECT
        story.*,
        author.username AS author,
        JSON_REMOVE(JSON_OBJECTAGG(
          IFNULL(sc.chapter_number, 'null__'),
          sc.title
        ), '$.null__') AS chapters
      FROM story
      LEFT JOIN storychapter AS sc ON sc.story_id = story.id
      INNER JOIN user AS author ON author.id = story.author_id
      WHERE (story.author_id = ? OR story.visibility = ?)
      ${conditionString}
      GROUP BY story.id
      ORDER BY ${options.sort ? `${options.sort} ${options.sortDesc ? 'DESC' : 'ASC'}` : 'updated_at DESC'}
    `, [ user.id, visibilityModes.PUBLIC, ...parsedConditions?.values ?? [] ]);
    return [200, stories];
  } catch (err) {
    logger.error(err);
    return [500];
  }
}

async function post(user, body) {
  if (!user) return [401];
  const { title, shortname, summary, visibility, universe: universeShort } = body;
  if (!title) return [400, 'Title is required.'];
  if (!shortname) return [400, 'Shortname is required.'];
  if (!universeShort) return [400, 'Universe is required.'];

  const [code, universe] = await api.universe.getOne(user, { 'universe.shortname': universeShort }, perms.WRITE);
  if (!universe) return [code];

  try {
    const data = await executeQuery(`
      INSERT INTO story (title, shortname, summary, visibility, author_id, universe_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [title, shortname, summary ?? null, visibility ?? visibilityModes.PRIVATE, user.id, universe.id]);
    return [201, data];
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return [400, `Shortname "${shortname}" already in use in this universe, please choose another.`];
    logger.error(err);
    return [500];
  }
}

module.exports = {
  setApi,
  visibilityModes,
  getOne,
  getMany,
  post,
};
