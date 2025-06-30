"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserAPI = exports.UserImageAPI = void 0;
const utils_1 = require("../utils");
const hashUtils_1 = __importDefault(require("../../lib/hashUtils"));
const logger_1 = __importDefault(require("../../logger"));
const config_1 = require("../../config");
class UserImageAPI {
    user;
    constructor(user) {
        this.user = user;
    }
    async getByUsername(username) {
        try {
            const [code, user] = await this.user.getOne({ 'user.username': username });
            if (!user)
                return [code];
            let queryString = `
        SELECT 
          user_id, name, mimetype, data
        FROM userimage
        WHERE user_id = ?;
      `;
            const image = (await (0, utils_1.executeQuery)(queryString, [user.id]))[0];
            return [200, image];
        }
        catch (err) {
            logger_1.default.error(err);
            return [500];
        }
    }
    async post(sessionUser, file, username) {
        if (!file)
            return [400];
        if (!sessionUser)
            return [401];
        if (sessionUser.username !== username)
            return [403];
        const { originalname, buffer, mimetype } = file;
        const [code, user] = await this.user.getOne({ 'user.username': username });
        if (!user)
            return [code];
        try {
            let data;
            await (0, utils_1.withTransaction)(async (conn) => {
                await conn.execute('DELETE FROM userimage WHERE user_id = ?', [user.id]);
                const queryString = `INSERT INTO userimage (user_id, name, mimetype, data) VALUES (?, ?, ?, ?);`;
                [data] = await conn.execute(queryString, [user.id, originalname.substring(0, 64), mimetype, buffer]);
            });
            return [201, data];
        }
        catch (err) {
            logger_1.default.error(err);
            return [500];
        }
    }
    async del(sessionUser, username) {
        try {
            if (!sessionUser)
                return [401];
            if (sessionUser.username !== username)
                return [403];
            const [code, user] = await this.user.getOne({ 'user.username': username });
            if (!user)
                return [code];
            return [200, await (0, utils_1.executeQuery)(`DELETE FROM userimage WHERE user_id = ?;`, [user.id])];
        }
        catch (err) {
            logger_1.default.error(err);
            return [500];
        }
    }
}
exports.UserImageAPI = UserImageAPI;
class UserAPI {
    image;
    api;
    constructor(api) {
        this.image = new UserImageAPI(this);
        this.api = api;
    }
    /**
     * returns a "safe" version of the user object with password data removed unless the includeAuth parameter is true
     * @param {*} options
     * @param {boolean} includeAuth
     * @returns {Promise<[number, User?]>}
     */
    async getOne(options, includeAuth = false, includeNotifs = false) {
        try {
            if (!options || Object.keys(options).length === 0)
                throw 'options required for api.get.user';
            const parsedOptions = (0, utils_1.parseData)(options);
            const queryString = `
        SELECT
          user.*,
          (ui.user_id IS NOT NULL) AS hasPfp,
          up.plan
          ${includeNotifs ? ', COUNT(notif.id) AS notifications' : ''}
        FROM user
        LEFT JOIN userimage AS ui ON user.id = ui.user_id
        LEFT JOIN userplan AS up ON user.id = up.user_id
        ${includeNotifs ? 'LEFT JOIN sentnotification AS notif ON user.id = notif.user_id AND NOT notif.is_read' : ''}
        WHERE ${parsedOptions.strings.join(' AND ')}
        GROUP BY user.id, up.plan
        LIMIT 1;
      `;
            const user = (await (0, utils_1.executeQuery)(queryString, parsedOptions.values))[0];
            if (!user)
                return [404];
            if (!includeAuth) {
                delete user.password;
                delete user.salt;
            }
            return [200, user];
        }
        catch (err) {
            logger_1.default.error(err);
            return [500];
        }
    }
    /**
     *
     * @param {*} options
     * @returns {Promise<[number, User?]>}
     */
    async getMany(options = null, includeEmail = false) {
        try {
            const parsedOptions = (0, utils_1.parseData)(options);
            let queryString;
            if (options)
                queryString = `
        SELECT 
          user.id, user.username, user.created_at, user.updated_at, ${includeEmail ? 'user.email, ' : ''}
          (ui.user_id IS NOT NULL) as hasPfp
        FROM user
        LEFT JOIN userimage AS ui ON user.id = ui.user_id
        WHERE ${parsedOptions.strings.join(' AND ')};
      `;
            else
                queryString = `SELECT id, username, created_at, updated_at ${includeEmail ? ', email' : ''} FROM user;`;
            const users = await (0, utils_1.executeQuery)(queryString, parsedOptions.values);
            return [200, users];
        }
        catch (err) {
            logger_1.default.error(err);
            return [500];
        }
    }
    async getByUniverseShortname(user, shortname) {
        const [code, universe] = await this.api.universe.getOne(user, { shortname });
        if (!universe)
            return [code];
        try {
            const queryString = `
        SELECT 
          user.id,
          user.username,
          user.created_at,
          user.updated_at,
          user.email,
          COUNT(item.id) AS items_authored,
          (ui.user_id IS NOT NULL) as hasPfp
        FROM user
        INNER JOIN authoruniverse AS au ON au.user_id = user.id
        LEFT JOIN item ON item.universe_id = au.universe_id AND item.author_id = user.id
        LEFT JOIN userimage AS ui ON user.id = ui.user_id
        WHERE au.universe_id = ?
        GROUP BY user.id;
      `;
            const users = await (0, utils_1.executeQuery)(queryString, [universe.id]);
            return [200, users];
        }
        catch (err) {
            logger_1.default.error(err);
            return [500];
        }
    }
    /**
     *
     * @param {*} user
     * @returns {Promise<[number, QueryResult]>}
     */
    async getSponsoredUniverses(user) {
        if (!user)
            return [400];
        try {
            const queryString = `
        SELECT
          usu.tier,
          JSON_ARRAYAGG(universe.title) AS universes,
          JSON_ARRAYAGG(universe.shortname) AS universe_shorts
        FROM usersponsoreduniverse AS usu
        INNER JOIN universe ON usu.universe_id = universe.id
        WHERE usu.user_id = ?
        GROUP BY usu.tier;
      `;
            const universes = await (0, utils_1.executeQuery)(queryString, [user.id]);
            return [200, universes];
        }
        catch (err) {
            logger_1.default.error(err);
            return [500];
        }
    }
    post({ username, email, password, hp }) {
        const salt = hashUtils_1.default.createRandom32String();
        if (!username)
            throw new Error('username is required');
        if (!email)
            throw new Error('email is required');
        if (!password)
            throw new Error('empty password not allowed');
        const validationError = this.validateUsername(username);
        if (validationError)
            throw new Error(validationError);
        const suspect = hp !== '';
        const queryString = `
      INSERT INTO user (
        username,
        email,
        salt,
        password,
        created_at,
        updated_at,
        suspect
      ) VALUES (?, ?, ?, ?, ?, ?, ?);
    `;
        return (0, utils_1.executeQuery)(queryString, [
            username,
            email,
            salt,
            hashUtils_1.default.createHash(password, salt),
            new Date(),
            new Date(),
            suspect
        ]);
    }
    /**
     *
     * @param {*} attempted
     * @param {*} password
     * @param {*} salt
     * @returns
     */
    validatePassword(attempted, password, salt) {
        return hashUtils_1.default.compareHash(attempted, password, salt);
    }
    validateUsername(username) {
        const RESERVED_USERNAMES = ['admin', 'moderator', 'root', 'support', 'system'];
        if (username.length < 3 || username.length > 32) {
            return 'Username must be between 3 and 32 characters long.';
        }
        if (RESERVED_USERNAMES.includes(username)) {
            return 'This username is reserved and cannot be used.';
        }
        if (/^\d+$/.test(username)) {
            return 'Usernames cannot be only numbers.';
        }
        if (/[-_]{2,}/.test(username)) {
            return 'Usernames cannot have consecutive dashes or underscores.';
        }
        if (/^[-]|[-]$/.test(username)) {
            return 'Usernames cannot start or end with a dash.';
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
            return 'Usernames can only contain letters, numbers, underscores, and hyphens.';
        }
        return null;
    }
    /**
     *
     * @param {*} user_id
     * @param {*} userIDToPut
     * @param {{ updated_at?, verified? }} param2
     * @returns
     */
    async put(user_id, userIDToPut, { updated_at, verified }) {
        const changes = { updated_at, verified };
        if (Number(user_id) !== Number(userIDToPut))
            return [403];
        try {
            const keys = Object.keys(changes).filter(key => changes[key] !== undefined);
            const values = keys.map(key => changes[key]);
            const queryString = `
        UPDATE user
        SET
          ${keys.map(key => `${key} = ?`).join(', ')}
        WHERE id = ?;
      `;
            return [200, await (0, utils_1.executeQuery)(queryString, [...values, userIDToPut])];
        }
        catch (err) {
            logger_1.default.error(err);
            return [500];
        }
    }
    async putPreferences(sessionUser, username, { preferred_theme }) {
        if (!sessionUser)
            return [401];
        const [code, user] = await this.getOne({ 'user.username': username }, true);
        if (!user)
            return [code];
        if (Number(sessionUser.id) !== Number(user.id))
            return [403];
        const changes = { preferred_theme };
        try {
            const keys = Object.keys(changes).filter(key => changes[key] !== undefined);
            if (keys.length === 0)
                return [400];
            const values = keys.map(key => changes[key]);
            const queryString = `
        UPDATE user
        SET
          ${keys.map(key => `${key} = ?`).join(', ')}
        WHERE id = ?;
      `;
            return [200, await (0, utils_1.executeQuery)(queryString, [...values, user.id])];
        }
        catch (err) {
            logger_1.default.error(err);
            return [500];
        }
    }
    async putUsername(sessionUser, oldUsername, newUsername) {
        const [code, user] = await this.getOne({ 'user.username': oldUsername });
        if (!user)
            return [code];
        if (Number(sessionUser.id) !== Number(user.id))
            return [403];
        const validationError = this.validateUsername(newUsername);
        if (validationError)
            return [400, validationError];
        const now = new Date();
        const cutoffInterval = 30 * 24 * 60 * 60 * 1000; // 30 Days
        const cutoffDate = new Date(now.getTime() - cutoffInterval);
        const recentChanges = await (0, utils_1.executeQuery)(`
      SELECT *
      FROM usernamechange
      WHERE changed_for = ? AND changed_at >= ?
      ORDER BY changed_at DESC;
    `, [user.id, cutoffDate]);
        if (recentChanges.length > 0)
            return [429, new Date(recentChanges[0].changed_at.getTime() + cutoffInterval)];
        try {
            const queryString = `
        UPDATE user
        SET
          username = ?
        WHERE id = ?;
      `;
            const data = await (0, utils_1.executeQuery)(queryString, [newUsername, user.id]);
            await (0, utils_1.executeQuery)(`
        INSERT INTO usernamechange (
          changed_for,
          changed_from,
          changed_to,
          changed_at
        ) VALUES (?, ?, ?, ?)
      `, [user.id, oldUsername, newUsername, new Date()]);
            return [200, data];
        }
        catch (err) {
            if (err.code === 'ER_DUP_ENTRY')
                return [400, 'Username already taken.'];
            logger_1.default.error(err);
            return [500];
        }
    }
    async putPassword(sessionUser, username, { oldPassword, newPassword }) {
        const [code, user] = await this.getOne({ 'user.username': username }, true);
        if (!user)
            return [code];
        if (Number(sessionUser.id) !== Number(user.id))
            return [403];
        const isCorrectLogin = this.validatePassword(oldPassword, user.password, user.salt);
        if (!isCorrectLogin)
            return [401];
        const salt = hashUtils_1.default.createRandom32String();
        try {
            const data = await (0, utils_1.executeQuery)(`
        UPDATE user
        SET
          salt = ?,
          password = ?
        WHERE id = ?
      `, [salt, hashUtils_1.default.createHash(newPassword, salt), user.id]);
            return [200, data];
        }
        catch (err) {
            logger_1.default.error(err);
            return [500];
        }
    }
    /**
     * WARNING: THIS METHOD IS *UNSAFE* AND SHOULD *ONLY* BE CALLED BY AUTHORIZED ROUTES!
     * @param {number} user_id id of user to delete
     * @returns {Promise<[number, User?]>}
     */
    async doDeleteUser(userId) {
        try {
            await (0, utils_1.withTransaction)(async (conn) => {
                await conn.execute('UPDATE comment SET body = NULL, author_id = NULL WHERE author_id = ?', [userId]);
                await conn.execute('UPDATE item SET author_id = NULL WHERE author_id = ?', [userId]);
                await conn.execute('UPDATE item SET last_updated_by = NULL WHERE last_updated_by = ?', [userId]);
                await conn.execute('UPDATE universe SET author_id = NULL WHERE author_id = ?', [userId]);
                // Promote highest-ranking user of abandoned universes with at least one other admin
                await conn.execute(`
          UPDATE authoruniverse
          INNER JOIN (
            SELECT MIN(au1.id) AS id
            FROM authoruniverse AS au1
            INNER JOIN (
              SELECT universe_id, MAX(permission_level) AS max_perm
              FROM authoruniverse
              WHERE universe_id IN (
                SELECT universe_id FROM authoruniverse WHERE user_id = ?
              ) AND user_id != ? AND permission_level >= ?
              GROUP BY universe_id
            ) au2 ON au1.universe_id = au2.universe_id AND au1.permission_level = au2.max_perm
            WHERE au1.permission_level < ?
            GROUP BY au1.universe_id
          ) AS to_promote ON authoruniverse.id = to_promote.id
          SET authoruniverse.permission_level = ?
        `, [userId, userId, utils_1.perms.ADMIN, utils_1.perms.OWNER, utils_1.perms.OWNER]);
                await conn.execute('DELETE FROM session WHERE user_id = ?', [userId]);
                await conn.execute('DELETE FROM user WHERE id = ?', [userId]);
                // Delete orphaned universes (universes with no other owner or admin)
                await conn.execute(`
          DELETE FROM universe
          WHERE id NOT IN (
            SELECT DISTINCT universe_id FROM authoruniverse WHERE permission_level >= ?
          )
        `, [utils_1.perms.ADMIN]);
            });
            return [200];
        }
        catch (err) {
            logger_1.default.error(err);
            return [500];
        }
    }
    async del(sessionUser, username, password) {
        if (!sessionUser)
            return [401];
        try {
            const [status, user] = await this.getOne({ 'user.username': username }, true);
            if (user) {
                if (sessionUser.id !== user.id) {
                    return [403, 'Can\'t delete user you\'re not logged in as!'];
                }
                const isCorrectLogin = this.validatePassword(password, user.password, user.salt);
                if (!isCorrectLogin) {
                    return [403, 'Password incorrect!'];
                }
                await (0, utils_1.executeQuery)('INSERT INTO userdeleterequest (user_id) VALUES (?);', [user.id]);
                await this.api.email.sendTemplateEmail(this.api.email.templates.DELETE, config_1.SITE_OWNER_EMAIL, { username });
                return [200];
            }
            else {
                return [status];
            }
        }
        catch (err) {
            logger_1.default.error(err);
            return [500];
        }
    }
    async getDeleteRequest(user) {
        if (!user)
            return [401];
        try {
            const request = (await (0, utils_1.executeQuery)('SELECT * FROM userdeleterequest WHERE user_id = ?', [user.id]))[0];
            if (!request)
                return [404];
            return [200, request];
        }
        catch (err) {
            logger_1.default.error(err);
            return [500];
        }
    }
    async prepareVerification(userId) {
        const verificationKey = hashUtils_1.default.createRandom32String();
        await (0, utils_1.executeQuery)('INSERT INTO userverification (user_id, verification_key) VALUES (?, ?);', [userId, verificationKey]);
        return verificationKey;
    }
    async verifyUser(verificationKey) {
        const records = await (0, utils_1.executeQuery)('SELECT user_id FROM userverification WHERE verification_key = ?;', [verificationKey]);
        if (records.length === 0)
            return [404];
        const [code, user] = await this.getOne({ id: records[0].user_id });
        if (!user)
            return [code];
        await this.put(user.id, user.id, { verified: true });
        await (0, utils_1.executeQuery)('DELETE FROM userverification WHERE user_id = ?;', [user.id]);
        logger_1.default.info(`User ${user.username} (${user.email}) verified!`);
        return [200, user.id];
    }
    async preparePasswordReset(userId) {
        const resetKey = hashUtils_1.default.createRandom32String();
        const now = new Date();
        const expiresIn = 7 * 24 * 60 * 60 * 1000;
        await (0, utils_1.executeQuery)('INSERT INTO userpasswordreset (user_id, reset_key, expires_at) VALUES (?, ?, ?);', [userId, resetKey, new Date(now.getTime() + expiresIn)]);
        return resetKey;
    }
    async resetPassword(resetKey, newPassword) {
        const records = await (0, utils_1.executeQuery)('SELECT user_id FROM userpasswordreset WHERE reset_key = ? AND expires_at > NOW();', [resetKey]);
        if (records.length === 0)
            return [404];
        const [code, user] = await this.getOne({ id: records[0].user_id });
        if (!user)
            return [code];
        const salt = hashUtils_1.default.createRandom32String();
        const newHashedPass = hashUtils_1.default.createHash(newPassword, salt);
        await (0, utils_1.withTransaction)(async (conn) => {
            await conn.execute('UPDATE user SET salt = ?, password = ? WHERE id = ?;', [salt, newHashedPass, user.id]);
            await conn.execute('DELETE FROM session WHERE user_id = ?;', [user.id]);
            await conn.execute('DELETE FROM userpasswordreset WHERE user_id = ?;', [user.id]);
        });
        logger_1.default.info(`Reset password for user ${user.username}.`);
        return [200, user.id];
    }
}
exports.UserAPI = UserAPI;
