const api = require('../../api');
const { perms } = require('../../api/utils');
const fs = require('fs/promises');
const { ADDR_PREFIX } = require('../../config');
module.exports = {
    /* Terms and Agreements */
    async privacyPolicy(_, res) {
        const content = (await fs.readFile('static/privacy_policy.md')).toString();
        res.prepareRender('docs', { content });
    },
    async termsOfService(_, res) {
        const content = (await fs.readFile('static/ToS.md')).toString();
        res.prepareRender('docs', { content });
    },
    async codeOfConduct(_, res) {
        const content = (await fs.readFile('static/code_of_conduct.md')).toString();
        res.prepareRender('docs', { content });
    },
    /* Newsletter */
    async news(req, res) {
        const [code, newsletter] = await api.newsletter.getOne(req.params.id);
        if (!newsletter) {
            res.status(code);
            return;
        }
        ;
        res.prepareRender('docs', {
            title: newsletter.title,
            content: newsletter.body,
            breadcrumbs: [['Home', `${ADDR_PREFIX}/`], ['News', `${ADDR_PREFIX}/news`], [newsletter.title]],
        });
    },
    async newsList(_, res) {
        const newsletters = (await api.newsletter.getMany())[1].map(n => n.body);
        res.prepareRender('news', { newsletters });
    },
    /* Help Pages */
    async markdownDemo(_, res) {
        const content = (await fs.readFile('static/markdown_demo.md')).toString();
        res.prepareRender('markdownDemo', { content });
    },
    /* Note pages */
    async notes(req, res) {
        const user = req.session.user;
        const [code, notes] = await api.note.getByUsername(user, user.username);
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
            const [code1, universes] = await api.universe.getMany(req.session.user, { strings: ['title LIKE ?'], values: [`%${search}%`] });
            res.status(code1);
            if (!universes)
                return;
            const [code2, items] = await api.item.getMany(req.session.user, null, perms.READ, { search });
            res.status(code2);
            if (!items)
                return;
            let notes, code3;
            if (req.session.user) {
                [code3, notes] = await api.note.getByUsername(req.session.user, req.session.user.username, null, { search });
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
