"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
// services/UserService.ts
const models_1 = require("../models");
const auth_1 = require("../utils/auth");
class UserService {
    sessionUser;
    email;
    constructor(sessionUser, email) {
        this.sessionUser = sessionUser;
        this.email = email;
    }
    async deleteUser(username, password) {
        const user = await models_1.UserModel.find(username);
        if (!user)
            return { status: 404, data: null, error: 'Not found' };
        if (this.sessionUser.id !== user.id) {
            return { status: 403, data: null, error: "Can't delete someone else" };
        }
        if (!(0, auth_1.validatePassword)(password, user.password, user.salt)) {
            return { status: 403, data: null, error: "Incorrect password" };
        }
        await user.requestDeletion();
        await this.email.sendTemplate('user-deletion', 'admin@example.com', { username });
        return { status: 200, data: null };
    }
}
exports.UserService = UserService;
