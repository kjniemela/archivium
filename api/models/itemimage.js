const { executeQuery, parseData, perms } = require('../utils');
const itemapi = require('./item');

async function getOneByItemShort(user, universeShortname, itemShortname, options) {
  const [code1, item] = await itemapi.getByUniverseAndItemShortnames(user, universeShortname, itemShortname, perms.READ, true);
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
        id, item_id, name, mimetype ${inclData ? ', data' : ''}
      FROM itemimage
    `;
    if (options) queryString += ` WHERE ${parsedOptions.strings.join(' AND ')}`;
    const users = await executeQuery(queryString, parsedOptions.values);
    return [200, users];
  } catch (err) {
    console.error(err);
    return [500];
  }
}

async function getManyByItemShort(user, universeShortname, itemShortname, options, inclData=false) {
  const [code1, item] = await itemapi.getByUniverseAndItemShortnames(user, universeShortname, itemShortname, perms.READ, true);
  if (!item) return [code1];
  const [code2, images] = await getMany({ item_id: item.id, ...(options ?? {}) }, inclData);
  if (code2 !== 200) return [code2];
  return [200, images];
}

async function post(user, file, universeShortname, itemShortname) {
  if (!file) return [400];
  if (!user) return [401];

  const { originalname, buffer, mimetype } = file;
  const [code, item] = await itemapi.getByUniverseAndItemShortnames(user, universeShortname, itemShortname, perms.WRITE, true);
  if (!item) return [code];

  const queryString = `INSERT INTO itemimage (item_id, name, mimetype, data, label) VALUES (?, ?, ?, ?, ?);`;
  return [201, await executeQuery(queryString, [ item.id, originalname, mimetype, buffer, '' ])];
}

async function del(user, imageId) {
  try {
    if (!user) return [401];
    const [_, image] = await getOne({ id: imageId });
    if (image) {
      if (image.owner_id === user.id) {
        const queryString = `DELETE FROM itemimage WHERE id = ?;`;
        await executeQuery(queryString, [imageId]);
        return [200];
      } else {
        return [403];
      }
    } else {
      return [404];
    }
  } catch (err) {
    console.error(err);
    return [500];
  }
}

module.exports = {
  getOneByItemShort,
  getMany,
  getManyByItemShort,
  post,
  del,
};