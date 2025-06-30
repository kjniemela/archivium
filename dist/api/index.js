"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.API = void 0;
const contact_1 = __importDefault(require("./models/contact"));
const discussion_1 = __importDefault(require("./models/discussion"));
const email_1 = require("./models/email");
const item_1 = __importDefault(require("./models/item"));
const newsletter_1 = __importDefault(require("./models/newsletter"));
const note_1 = __importDefault(require("./models/note"));
const notification_1 = require("./models/notification");
const session_1 = __importDefault(require("./models/session"));
const story_1 = __importDefault(require("./models/story"));
const universe_1 = __importDefault(require("./models/universe"));
const user_1 = require("./models/user");
class API {
    contact;
    discussion;
    email;
    item;
    newsletter;
    note;
    notification;
    session;
    story;
    universe;
    user;
    constructor() {
        this.contact = contact_1.default;
        this.discussion = discussion_1.default;
        this.email = new email_1.EmailAPI(this);
        this.item = item_1.default;
        this.newsletter = newsletter_1.default;
        this.note = note_1.default;
        this.notification = new notification_1.NotificationAPI(this);
        this.session = session_1.default;
        this.story = story_1.default;
        this.universe = universe_1.default;
        this.user = new user_1.UserAPI(this);
    }
}
exports.API = API;
const api = new API();
contact_1.default.setApi(api);
discussion_1.default.setApi(api);
item_1.default.setApi(api);
newsletter_1.default.setApi(api);
note_1.default.setApi(api);
session_1.default.setApi(api);
story_1.default.setApi(api);
universe_1.default.setApi(api);
exports.default = api;
