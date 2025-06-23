const { executeQuery, parseData } = require('../utils');
const logger = require('../../logger');
let api;
function setApi(_api) {
    api = _api;
}
/**
 * These methods should only be called from scripts or safe routes, no validation is being done here!
 */
async function getOne(id) {
    try {
        const [code, newsletters] = await getMany({ id });
        if (!newsletters)
            return [code];
        const newsletter = newsletters[0];
        if (!newsletter)
            return [404];
        return [200, newsletter];
    }
    catch (err) {
        logger.error(err);
        return [500];
    }
}
async function getMany(conditions) {
    const parsedConds = parseData(conditions ?? {});
    try {
        const subscription = await executeQuery(`
      SELECT *
      FROM newsletter
      ${conditions ? `WHERE ${parsedConds.strings.join(' AND ')}` : ''}
      ORDER BY created_at DESC
    `, parsedConds.values);
        return [200, subscription];
    }
    catch (err) {
        logger.error(err);
        return [500];
    }
}
async function post({ title, preview, body }) {
    try {
        const queryString = `INSERT INTO newsletter (title, preview, body, created_at) VALUES (?, ?, ?, ?);`;
        const data = await executeQuery(queryString, [title, preview, body, new Date()]);
        return [201, data];
    }
    catch (err) {
        logger.error(err);
        return [500];
    }
}
module.exports = {
    setApi,
    getOne,
    getMany,
    post,
};
