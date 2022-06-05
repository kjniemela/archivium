const Model = require('./model');

/**
 *
 * @constructor
 * @augments Model
 */
class Universes extends Model {
  constructor() {
    super('universes');
  }

  /**
   * Gets all records in the table matching the specified conditions.
   * @param {Object} options - An object where the keys are column names and the
   * values are the current values to be matched.
   * @returns {Promise<Array>} A promise that is fulfilled with an array of objects
   * matching the conditions or is rejected with the the error that occurred during
   * the query.
   */
   getAll(user, options) {
    const usrQueryString = user ? ` OR id IN (SELECT universeId FROM authoruniverses WHERE userId = ${user.id} AND permissionLevel <> 0)` : '';
    if (!options) {
      let queryString = `SELECT * FROM ${this.tablename} WHERE public = 1${usrQueryString}`;
      return this.executeQuery(queryString);
    }
    let parsedOptions = this.parseData(options);
    let queryString = `SELECT * FROM ${this.tablename} WHERE (public = 1${usrQueryString}) AND (${parsedOptions.string.join(' AND ')})`;
    return this.executeQuery(queryString, [ parsedOptions.values ]);
  }

  /**
   * Gets one record in the table matching specified conditions, and attaches user
   * information if the userId is present on the session object.
   * @param {Object} options - An object where the keys are the column names and the values
   * are the values to be matched.
   * @returns {Promise<Object>} A promise that is fulfilled with the session object
   * or rejected with the error that occured. Note that even if multiple session records
   * match the options, the promise will only be fulfilled with one.
   */
  async get(options) {
    const data = await super.get.call(this, options);
    data.public = data.public.readInt8();
    return data;
  }

  /**
   * Creates a new record in the table.
   * @param {Object} options - An object with key/value pairs, where the keys should match
   * the column names and the values should be of the correct type for that table. See model
   * class definition for additional information about the schema.
   * @returns {Promise<Object>} A promise that is fulfilled with an object
   * containing the results of the query or is rejected with the the error that occurred
   * during the query.
   */
  async create(options) {
    const data = await super.create.call(this, {
      ...options,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(data.insertId);
    const queryString = `INSERT INTO authoruniverses SET ?`;
    return [data, await this.executeQuery(queryString, {
      universeId: data.insertId,
      userId: options.authorId,
      permissionLevel: 3,

    })];
  }
}

module.exports = new Universes();

