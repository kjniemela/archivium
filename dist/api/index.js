"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.API = void 0;
const contact_1 = require("./models/contact");
const discussion_1 = require("./models/discussion");
const email_1 = require("./models/email");
const item_1 = require("./models/item");
const newsletter_1 = require("./models/newsletter");
const note_1 = require("./models/note");
const notification_1 = require("./models/notification");
const session_1 = require("./models/session");
const story_1 = require("./models/story");
const universe_1 = require("./models/universe");
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
        this.contact = new contact_1.ContactAPI(this);
        this.discussion = new discussion_1.DiscussionAPI(this);
        this.email = new email_1.EmailAPI(this);
        this.item = new item_1.ItemAPI(this);
        this.newsletter = new newsletter_1.NewsletterAPI(this);
        this.note = new note_1.NoteAPI(this);
        this.notification = new notification_1.NotificationAPI(this);
        this.session = new session_1.SessionAPI(this);
        this.story = new story_1.StoryAPI(this);
        this.universe = new universe_1.UniverseAPI(this);
        this.user = new user_1.UserAPI(this);
    }
}
exports.API = API;
const api = new API();
exports.default = api;
