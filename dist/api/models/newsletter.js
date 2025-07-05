"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsletterAPI = void 0;
const utils_1 = require("../utils");
const errors_1 = require("../../errors");
class NewsletterAPI {
    api;
    constructor(api) {
        this.api = api;
    }
    /**
     * These methods should only be called from scripts or safe routes, no validation is being done here!
     */
    async getOne(id) {
        try {
            const newsletters = await this.getMany({ id });
            const newsletter = newsletters[0];
            if (!newsletter)
                throw new errors_1.NotFoundError('Newsletter not found');
            return newsletter;
        }
        catch (err) {
            throw new errors_1.ModelError(err);
        }
    }
    async getMany(conditions) {
        try {
            const parsedConds = (0, utils_1.parseData)(conditions ?? {});
            const subscription = await (0, utils_1.executeQuery)(`
        SELECT *
        FROM newsletter
        ${conditions ? `WHERE ${parsedConds.strings.join(' AND ')}` : ''}
        ORDER BY created_at DESC
      `, parsedConds.values);
            return subscription;
        }
        catch (err) {
            throw new errors_1.ModelError(err);
        }
    }
    async post({ title, preview, body }) {
        try {
            const queryString = `INSERT INTO newsletter (title, preview, body, created_at) VALUES (?, ?, ?, ?);`;
            return await (0, utils_1.executeQuery)(queryString, [title, preview, body, new Date()]);
        }
        catch (err) {
            throw new errors_1.ModelError(err);
        }
    }
}
exports.NewsletterAPI = NewsletterAPI;
