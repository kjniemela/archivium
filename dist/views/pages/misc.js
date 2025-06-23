"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = __importDefault(require("../../api"));
const utils_1 = require("../../api/utils");
const promises_1 = __importDefault(require("fs/promises"));
const config_1 = require("../../config");
exports.default = {
    /* Terms and Agreements */
    async privacyPolicy(_, res) {
        const content = (await promises_1.default.readFile('static/privacy_policy.md')).toString();
        res.prepareRender('docs', { content });
    },
    async termsOfService(_, res) {
        const content = (await promises_1.default.readFile('static/ToS.md')).toString();
        res.prepareRender('docs', { content });
    },
    async codeOfConduct(_, res) {
        const content = (await promises_1.default.readFile('static/code_of_conduct.md')).toString();
        res.prepareRender('docs', { content });
    },
    /* Home Page */
    async home(req, res) {
        const user = req.session.user;
        if (user) {
            const [code1, universes] = await api_1.default.universe.getMany(user, null, utils_1.perms.WRITE);
            res.status(code1);
            if (!universes)
                return;
            const [code2, followedUniverses] = await api_1.default.universe.getMany(user, {
                strings: ['fu.user_id = ?', 'fu.is_following = ?'],
                values: [user.id, true],
            }, utils_1.perms.READ);
            res.status(code2);
            if (!followedUniverses)
                return;
            const followedUniverseIds = `(${followedUniverses.map(universe => universe.id).join(',')})`;
            const [code3, recentlyUpdated] = followedUniverses.length > 0 ? await api_1.default.item.getMany(user, null, utils_1.perms.READ, {
                sort: 'updated_at',
                sortDesc: true,
                limit: 8,
                select: [['lub.username', 'last_updated_by']],
                join: [['LEFT', ['user', 'lub'], new utils_1.Cond('lub.id = item.last_updated_by')]],
                where: new utils_1.Cond(`item.universe_id IN ${followedUniverseIds}`)
                    .and(new utils_1.Cond('lub.id <> ?', user.id).or(new utils_1.Cond('item.last_updated_by IS NULL').and('item.author_id <> ?', user.id))),
            }) : [200, []];
            res.status(code3);
            const [code4, oldestUpdated] = await api_1.default.item.getMany(user, null, utils_1.perms.WRITE, {
                sort: `GREATEST(IFNULL(snooze.snoozed_at, '1000-01-01'), IFNULL(item.updated_at, '1000-01-01'))`,
                sortDesc: false,
                forceSort: true,
                limit: 16,
                join: [['LEFT', 'snooze', new utils_1.Cond('snooze.item_id = item.id').and('snooze.snoozed_by = ?', user.id)]],
                where: new utils_1.Cond('item.updated_at < DATE_SUB(NOW(), INTERVAL 2 DAY)'),
                groupBy: ['snooze.snoozed_at'],
            });
            res.status(code4);
            if (!oldestUpdated)
                return;
            // if (universes.length === 1) {
            //   res.redirect(`${ADDR_PREFIX}/universes/${universes[0].shortname}`);
            // }
            return res.prepareRender('home', { universes, followedUniverses, recentlyUpdated, oldestUpdated });
        }
        res.prepareRender('home', { universes: [] });
    },
    /* Newsletter */
    async news(req, res) {
        const [code, newsletter] = await api_1.default.newsletter.getOne(req.params.id);
        if (!newsletter) {
            res.status(code);
            return;
        }
        ;
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
        const [code, notes] = await api_1.default.note.getByUsername(user, user.username);
        const noteAuthors = { [user.id]: user };
        res.status(code);
        if (!notes)
            return;
        res.prepareRender('notes', {
            notes,
            noteAuthors,
            noteBaseRoute: `/api/users/${user.username}/notes`,
        });
    },
    /* Misc pages */
    async search(req, res) {
        const search = req.query.search;
        if (search) {
            const [code1, universes] = await api_1.default.universe.getMany(req.session.user, { strings: ['title LIKE ?'], values: [`%${search}%`] });
            res.status(code1);
            if (!universes)
                return;
            const [code2, items] = await api_1.default.item.getMany(req.session.user, null, utils_1.perms.READ, { search });
            res.status(code2);
            if (!items)
                return;
            let notes, code3;
            if (req.session.user) {
                [code3, notes] = await api_1.default.note.getByUsername(req.session.user, req.session.user.username, null, { search });
                res.status(code3);
                if (!notes)
                    return;
            }
            res.prepareRender('search', { items, universes, notes: notes ?? [], search });
        }
        else {
            res.prepareRender('search', { items: [], universes: [], notes: [], search: '' });
        }
    },
};
