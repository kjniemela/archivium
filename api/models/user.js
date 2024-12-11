const { executeQuery, parseData } = require('../utils');
const utils = require('../../lib/hashUtils');
const universeapi = require('./universe');
const logger = require('../../logger');

/**
   * returns a "safe" version of the user object with password data removed unless the includeAuth parameter is true
   * @param {*} options 
   * @param {boolean} includeAuth 
   * @returns {Promise<[status, data]>}
   */
async function getOne(options, includeAuth=false) {
  try {
    if (!options || Object.keys(options).length === 0) throw 'options required for api.get.user';
    const parsedOptions = parseData(options);
    const queryString = `SELECT * FROM user WHERE ${parsedOptions.strings.join(' AND ')} LIMIT 1;`;
    const user = (await executeQuery(queryString, parsedOptions.values))[0];
    if (!user) return [404];
    if (!includeAuth) {
      delete user.password;
      delete user.salt;
    }
    return [200, user];
  } catch (err) {
    logger.error(err);
    return [500];
  }
}

/**
 * 
 * @param {*} options
 * @returns {Promise<[status, data]>}
 */
async function getMany(options, includeEmail=false) {
  try {
    const parsedOptions = parseData(options);
    let queryString;
    if (options) queryString = `
      SELECT 
        id, username, created_at, updated_at ${includeEmail ? ', email' : ''}
      FROM user 
      WHERE ${parsedOptions.strings.join(' AND ')};
    `;
    else queryString = `SELECT id, username, created_at, updated_at ${includeEmail ? ', email' : ''} FROM user;`;
    const users = await executeQuery(queryString, parsedOptions.values);
    return [200, users];
  } catch (err) {
    logger.error(err);
    return [500];
  }
}

async function getByUniverseShortname(user, shortname) {

  const [code, universe] = await universeapi.getOne(user, { shortname });
  if (!universe) return [code];

  try {
    const queryString = `
      SELECT 
        user.id,
        user.username,
        user.created_at,
        user.updated_at,
        user.email,
        COUNT(item.id) AS items_authored
      FROM user
      INNER JOIN authoruniverse AS au ON au.user_id = user.id
      LEFT JOIN item ON item.universe_id = au.universe_id AND item.author_id = user.id
      WHERE au.universe_id = ?
      GROUP BY user.id;
    `;
    const users = await executeQuery(queryString, [universe.id]);
    return [200, users];
  } catch (err) {
    logger.error(err);
    return [500];
  }
}

/**
 * 
 * @param {*} userData 
 * @returns 
 */
function post({ username, email, password }) {
  const salt = utils.createRandom32String();

  if (!username) throw new Error('malformed username');
  if (!email) throw new Error('malformed email');

  const queryString = `
    INSERT INTO user (
      username,
      email,
      salt,
      password,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?);
  `;
  return executeQuery(queryString, [
    username,
    email,
    salt,
    utils.createHash(password, salt),
    new Date(),
    new Date()
  ]);
}

/**
 * 
 * @param {*} attempted 
 * @param {*} password 
 * @param {*} salt 
 * @returns 
 */
function validatePassword(attempted, password, salt) {
  return utils.compareHash(attempted, password, salt);
}

async function put(user_id, userIDToPut, { updated_at, verified }) {
  const changes = { updated_at, verified };

  if (Number(user_id) !== Number(userIDToPut)) return [403];

  try {
    const keys = Object.keys(changes).filter(key => changes[key] !== undefined);
    const values = keys.map(key => changes[key]);
    const queryString = `
      UPDATE user
      SET
        ${keys.map(key => `${key} = ?`).join(', ')}
      WHERE id = ?;
    `;
    return [200, await executeQuery(queryString, [...values, userIDToPut])];
  } catch (err) {
    logger.error(err);
    return [500];
  }
}

/**
 * WARNING: THIS METHOD IS *UNSAFE* AND SHOULD *ONLY* BE CALLED BY AUTHORIZED ROUTES!
 * @param {number} user_id id of user to delete 
 * @returns {Promise<[status, data]>}
 */
async function doDeleteUser(user_id) {
  try {
    const sessionQueryString = `DELETE FROM session WHERE user_id = ${user_id};`;
    const userQueryString = `DELETE FROM user WHERE id = ${user_id};`;
    await executeQuery(sessionQueryString);
    await executeQuery(userQueryString);
    return [200];
  } catch (err) {
    logger.error(err);
    return [500];
  }
}

async function del(req) {
  try {  
    const [status, user] = await getOne({ id: req.params.id, email: req.body.email }, true);
    if (user) {
      req.loginId = user.id;
      const isValidUser = validatePassword(req.body.password, user.password, user.salt);
      if (isValidUser) {
        doDeleteUser(req.params.id);
        return [200];
      } else {
        return [401];
      }
    } else {
      return [404];
    }
  } catch (err) {
    logger.error(err);
    return [500];
  }
}

async function prepareVerification(userId) {
  const verificationKey = utils.createRandom32String();

  await executeQuery('INSERT INTO userverification (user_id, verification_key) VALUES (?, ?);', [userId, verificationKey]);

  return verificationKey;
}

async function verifyUser(verificationKey) {
  const records = await executeQuery('SELECT user_id FROM userverification WHERE verification_key = ?;', [verificationKey]);
  if (records.length === 0) return [404];
  const [code, user] = await getOne({ id: records[0].user_id });
  if (!user) return [code];
  await put(user.id, user.id, { verified: true });

  return [200];
}

module.exports = {
  getOne,
  getMany,
  getByUniverseShortname,
  post,
  validatePassword,
  put,
  del,
  prepareVerification,
  verifyUser,
};