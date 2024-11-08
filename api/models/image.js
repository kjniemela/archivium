const { executeQuery, parseData } = require('../utils');

async function getOne(user, options) {
  const [code, data] = await getMany(user, options);
  if (code !== 200) return [code];
  const image = data[0];
  if (!image) return [404];
  return [200, image];
}

async function getMany(options) {
  try {
    const parsedOptions = parseData(options);
    let queryString = `
      SELECT 
        id, owner_id, name, data
      FROM image
    `;
    if (options) queryString += ` WHERE ${parsedOptions.strings.join(' AND ')}`;
    const users = await executeQuery(queryString, parsedOptions.values);
    return [200, users];
  } catch (err) {
    console.error(err);
    return [500];
  }
}

async function post(user, { name, data }) {
  if (!user) return [401];

  const queryString = `INSERT INTO image (owner_id, name, data) VALUES (?, ?, ?);`;
  return [201, await executeQuery(queryString, [ user.id, name, data ])];
}

async function del(user, imageId) {
  try {
    if (!user) return [401];
    const [_, image] = await getOne({ id: imageId });
    if (image) {
      if (image.owner_id === user.id) {
        const queryString = `DELETE FROM image WHERE id = ?;`;
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
  getOne,
  getMany,
  post,
  del,
};