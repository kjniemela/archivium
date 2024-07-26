const { executeQuery, parseData } = require('../utils');

const perms = {
  NONE: 0,
  READ: 1,
  WRITE: 2,
  ADMIN: 3,
};

async function getOne(user, options, permissionLevel) {
  const parsedOptions = parseData(options);

  const [code, data] = await getMany(user, parsedOptions, permissionLevel);
  if (code !== 200) return [code];
  const universe = data[0];
  if (!universe) return [user ? 403 : 401];
  return [200, universe];
}

/**
 * base function for fetching universes from database
 * @param {*} user 
 * @param {*} conditions 
 * @param {number} permission_level
 * @returns 
 */
async function getMany(user, conditions, permissionLevel=perms.READ) {
  try {
    const usrQueryString = user ? ` OR universe_id IN (SELECT universe_id FROM authoruniverse as a WHERE a.user_id = ${user.id} AND a.permission_level >= ${permissionLevel})` : '';
    const conditionString = conditions ? ` AND ${conditions.strings.join(' AND ')}` : '';
    const queryString = `
      SELECT
        universe.*,
        JSON_OBJECTAGG(user.id, user.username) as authors,
        JSON_OBJECTAGG(user.id, authoruniverse.permission_level) as author_permissions,
        owner.username as owner
      FROM authoruniverse
      INNER JOIN user ON user.id = user_id
      INNER JOIN universe ON universe.id = universe_id 
      INNER JOIN user as owner ON universe.author_id = owner.id
      WHERE (universe.public = 1${usrQueryString})
      ${conditionString}
      GROUP BY universe_id;`;
    const data = await executeQuery(queryString, conditions && conditions.values);
    return [200, data];
  } catch (err) {
    console.error(err);
    return [500];
  }
}

function getManyByAuthorId(user, authorId) {
  return getMany(user, { 
    strings: [
      'universe_id IN (SELECT universe_id FROM authoruniverse as au WHERE au.user_id = ? AND au.permission_level > 0)',
    ], values: [
      authorId,
    ] 
  });
}

async function post(user, body) {
  try {
    const queryString1 = `INSERT INTO universe SET ?`;
    const data = await executeQuery(queryString1, {
      title: body.title,
      shortname: body.shortname,
      author_id: user.id,
      public: body.public,
      obj_data: body.obj_data,
      created_at: new Date(),
      updated_at: new Date(),
    });
    const queryString2 = `INSERT INTO authoruniverse SET ?`;
    return [201, [data, await executeQuery(queryString2, {
      universe_id: data.insertId,
      user_id: user.id,
      permission_level: 3,
    })]];
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return [400, 'universe.shortname must be unique.'];
    if (err.code === 'ER_BAD_NULL_ERROR') return [400, 'Missing parameters.'];
    console.error(err);
    return [500];
  }
}

module.exports = {
  perms,
  getOne,
  getMany,
  getManyByAuthorId,
  post,
};