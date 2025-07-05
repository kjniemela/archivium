"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = __importDefault(require("../../api"));
const utils_1 = require("../../api/utils");
const promises_1 = __importDefault(require("fs/promises"));
const config_1 = require("../../config");
const path_1 = __importDefault(require("path"));
const staticDir = path_1.default.join(__dirname, '../../static');
exports.default = {
    /* Terms and Agreements */
    async privacyPolicy(_, res) {
        const content = (await promises_1.default.readFile(path_1.default.join(staticDir, 'privacy_policy.md'))).toString();
        res.prepareRender('docs', { content });
    },
    async termsOfService(_, res) {
        const content = (await promises_1.default.readFile(path_1.default.join(staticDir, 'ToS.md'))).toString();
        res.prepareRender('docs', { content });
    },
    async codeOfConduct(_, res) {
        const content = (await promises_1.default.readFile(path_1.default.join(staticDir, 'code_of_conduct.md'))).toString();
        res.prepareRender('docs', { content });
    },
    /* Home Page */
    async home(req, res) {
        const user = req.session.user;
        if (user) {
            const universes = await api_1.default.universe.getMany(user, null, utils_1.perms.WRITE);
            const followedUniverses = await api_1.default.universe.getMany(user, {
                strings: ['fu.user_id = ?', 'fu.is_following = ?'],
                values: [user.id, true],
            }, utils_1.perms.READ);
            const followedUniverseIds = `(${followedUniverses.map(universe => universe.id).join(',')})`;
            const recentlyUpdated = followedUniverses.length > 0 ? await api_1.default.item.getMany(user, null, utils_1.perms.READ, {
                sort: 'updated_at',
                sortDesc: true,
                limit: 8,
                select: [['lub.username', 'last_updated_by']],
                join: [['LEFT', ['user', 'lub'], new utils_1.Cond('lub.id = item.last_updated_by')]],
                where: new utils_1.Cond(`item.universe_id IN ${followedUniverseIds}`)
                    .and(new utils_1.Cond('lub.id <> ?', user.id).or(new utils_1.Cond('item.last_updated_by IS NULL').and('item.author_id <> ?', user.id))),
            }) : [200, []];
            const oldestUpdated = await api_1.default.item.getMany(user, null, utils_1.perms.WRITE, {
                sort: `GREATEST(IFNULL(snooze.snoozed_at, '1000-01-01'), IFNULL(item.updated_at, '1000-01-01'))`,
                sortDesc: false,
                forceSort: true,
                limit: 16,
                join: [['LEFT', 'snooze', new utils_1.Cond('snooze.item_id = item.id').and('snooze.snoozed_by = ?', user.id)]],
                where: new utils_1.Cond('item.updated_at < DATE_SUB(NOW(), INTERVAL 2 DAY)'),
                groupBy: ['snooze.snoozed_at'],
            });
            return res.prepareRender('home', { universes, followedUniverses, recentlyUpdated, oldestUpdated });
        }
        res.prepareRender('home', { universes: [] });
    },
    /* Newsletter */
    async news(req, res) {
        const newsletter = await api_1.default.newsletter.getOne(Number(req.params.id));
        res.prepareRender('docs', {
            title: newsletter.title,
            content: newsletter.body,
            breadcrumbs: [['Home', `${config_1.ADDR_PREFIX}/`], ['News', `${config_1.ADDR_PREFIX}/news`], [newsletter.title]],
        });
    },
    async newsList(_, res) {
        const newsletters = (await api_1.default.newsletter.getMany())[1].map(n => n.body);
        res.prepareRender('news', { newsletters });
    },
    /* Help Pages */
    async markdownDemo(_, res) {
        const content = (await promises_1.default.readFile('static/markdown_demo.md')).toString();
        res.prepareRender('markdownDemo', { content });
    },
    /* Note pages */
    async notes(req, res) {
        const user = req.session.user;
        const notes = await api_1.default.note.getByUsername(user, user.username);
        const noteAuthors = { [user.id]: user };
        res.prepareRender('notes', {
            notes,
            noteAuthors,
            noteBaseRoute: `/api/users/${user.username}/notes`,
        });
    },
    /* Misc pages */
    async search(req, res) {
        const search = req.getQueryParam('search');
        if (search) {
            const universes = await api_1.default.universe.getMany(req.session.user, { strings: ['title LIKE ?'], values: [`%${search}%`] });
            const items = await api_1.default.item.getMany(req.session.user, null, utils_1.perms.READ, { search });
            const notes = req.session.user ? await api_1.default.note.getByUsername(req.session.user, req.session.user.username, null, { search }) : [];
            res.prepareRender('search', { items, universes, notes, search });
        }
        else {
            res.prepareRender('search', { items: [], universes: [], notes: [], search: '' });
        }
    },
};
