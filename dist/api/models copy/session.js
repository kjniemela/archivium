const { executeQuery, parseData } = require('../utils');
const utils = require('../../lib/hashUtils');
let api;
function setApi(_api) {
    api = _api;
}
/**
 * for internal use only - does not conform to the standard return format!
 * @param {{ [key: string]: any }} options
 * @returns {Promise<session>}
 */
async function getOne(options) {
    const parsedOptions = parseData(options);
    const queryString = `SELECT * FROM session WHERE ${parsedOptions.strings.join(' AND ')} LIMIT 1;`;
    const data = await executeQuery(queryString, parsedOptions.values);
    const session = data[0];
    if (!session || !session.user_id)
        return session;
    const [_, user] = await api.user.getOne({ 'user.id': session.user_id }, false, true);
    session.user = user;
    return session;
}
/**
 * for internal use only - does not conform to the standard return format!
 * @returns
 */
function post() {
    const data = utils.createRandom32String();
    const hash = utils.createHash(data);
    const queryString = `INSERT INTO session (hash, created_at) VALUES (?, ?);`;
    return executeQuery(queryString, [hash, new Date()]);
}
/**
 * for internal use only - does not conform to the standard return format!
 * @param {{[key: string]: any}} options
 * @param {{[key: string]: any}} values
 * @returns
 */
function put(options, changes) {
    const { user_id } = changes;
    const parsedOptions = parseData(options);
    const queryString = `UPDATE session SET user_id = ? WHERE ${parsedOptions.strings.join(' AND ')}`;
    return executeQuery(queryString, [user_id, ...parsedOptions.values]);
}
/**
 * for internal use only - does not conform to the standard return format!
 * @param {*} options
 * @returns
 */
function del(options) {
    const parsedOptions = parseData(options);
    const queryString = `DELETE FROM session WHERE ${parsedOptions.strings.join(' AND ')}`;
    return executeQuery(queryString, parsedOptions.values);
}
module.exports = {
    setApi,
    getOne,
    post,
    put,
    delete: del,
};
