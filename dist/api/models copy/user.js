"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
// models/User.ts
const errors_1 = require("../../errors");
const _1 = require(".");
const hashUtils_1 = require("../../lib/hashUtils");
class User extends _1.Model {
    static TABLE = 'user';
    id = null;
    username;
    email;
    password;
    salt;
    created_at;
    updated_at;
    static validateUsername(username) {
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
    constructor(data) {
        super();
        this.id = data.id ?? null;
        this.username = data.username;
        this.email = data.email;
        this.password = data.password;
        this.salt = data.salt;
        this.created_at = data.created_at ?? new Date();
        this.updated_at = data.updated_at ?? new Date();
    }
    static async find(conds) {
        const rows = await User.findAll(conds);
        if (rows.length === 0)
            return null;
        return rows[0];
    }
    static async findOrThrow(conds) {
        const user = await User.find(conds);
        if (!user) {
            throw new errors_1.NotFoundError();
        }
        return user;
    }
    static async findAll(conds = {}) {
        const [str, values] = _1.Model.parseConditions(conds);
        const rows = await _1.Model.query(`SELECT * FROM ${User.TABLE} WHERE ${str}`, values);
        return rows.map(row => new User(row));
    }
    async save() {
        if (this.id === null) {
            const validationError = User.validateUsername(this.username);
            if (validationError) {
                throw new errors_1.ValidationError(validationError);
            }
            if (!this.password) {
                throw new errors_1.ValidationError('Password is required when creating new user.');
            }
            this.salt = (0, hashUtils_1.createRandom32String)();
            const { insertId } = await _1.Model.insert(User.TABLE, this.toJSON());
            this.id = insertId;
        }
        else {
            await _1.Model.update(User.TABLE, this.id, this.toJSON());
        }
    }
    async delete() {
        if (this.id !== null) {
            await _1.Model.query(`DELETE FROM ${User.TABLE} WHERE id = ?`, [this.id]);
        }
    }
    toJSON() {
        return {
            id: this.id ?? undefined,
            username: this.username,
            email: this.email,
            password: this.password,
            salt: this.salt,
            created_at: this.created_at,
            updated_at: this.updated_at,
        };
    }
}
exports.User = User;
