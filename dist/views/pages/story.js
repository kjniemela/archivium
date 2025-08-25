"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const html_string_1 = require("@tiptap/static-renderer/pm/html-string");
const sanitize_html_1 = __importDefault(require("sanitize-html"));
const api_1 = __importDefault(require("../../api"));
const utils_1 = require("../../api/utils");
const config_1 = require("../../config");
const errors_1 = require("../../errors");
const editor_1 = require("../../lib/editor");
const tiptapHelpers_1 = require("../../lib/tiptapHelpers");
const locale_1 = require("../../locale");
const logger_1 = __importDefault(require("../../logger"));
const templates_1 = require("../../templates");
exports.default = {
    async list(req, res) {
        const search = req.getQueryParam('search');
        const stories = await api_1.default.story.getMany(req.session.user, null, utils_1.perms.READ, {
            sort: req.getQueryParam('sort'),
            sortDesc: req.getQueryParam('sort_order') === 'desc',
            search,
        });
        res.prepareRender('storyList', { stories, search });
    },
    async create(req, res) {
        const universes = await api_1.default.universe.getMany(req.session.user, null, utils_1.perms.WRITE);
        res.prepareRender('createStory', { universes });
    },
    async view(req, res) {
        const story = await api_1.default.story.getOne(req.session.user, { 'story.shortname': req.params.shortname });
        res.prepareRender('story', { story });
    },
    async delete(req, res) {
        try {
            const story = await api_1.default.story.getOne(req.session.user, { 'story.shortname': req.params.shortname }, utils_1.perms.OWNER);
            res.prepareRender('deleteStory', { story });
        }
        catch (err) {
            if (err instanceof errors_1.NotFoundError) {
                return res.redirect(`${config_1.ADDR_PREFIX}/stories`);
            }
            throw err;
        }
    },
    async edit(req, res) {
        const fetchedStory = await api_1.default.story.getOne(req.session.user, { 'story.shortname': req.params.shortname }, utils_1.perms.WRITE);
        const story = { ...fetchedStory, ...(req.body ?? {}), shortname: fetchedStory.shortname, newShort: req.body?.shortname ?? fetchedStory.shortname };
        res.prepareRender('editStory', { story, error: res.error });
    },
    async createChapter(req, res) {
        const story = await api_1.default.story.getOne(req.session.user, { 'story.shortname': req.params.shortname });
        const title = `${(0, locale_1.T)('Untitled Chapter')} ${story.chapter_count + 1}`;
        const [, index] = await api_1.default.story.postChapter(req.session.user, story.shortname, { title });
        return res.redirect(`${config_1.ADDR_PREFIX}/editor/stories/${story.shortname}/${index}`);
    },
    async viewChapter(req, res) {
        const story = await api_1.default.story.getOne(req.session.user, { 'story.shortname': req.params.shortname });
        const chapter = await api_1.default.story.getChapter(req.session.user, story.shortname, Number(req.params.index));
        const [comments, commentUsers] = await api_1.default.discussion.getCommentsByChapter(chapter.id, true);
        const commenters = {};
        for (const user of commentUsers) {
            user.pfpUrl = (0, utils_1.getPfpUrl)(user);
            delete user.email;
            commenters[user.id] = user;
        }
        let renderedBody;
        try {
            const links = [];
            const headings = [];
            const jsonBody = (0, tiptapHelpers_1.indexedToJson)(chapter.body, (href) => links.push((0, editor_1.extractLinkData)(href)), (title, level) => headings.push({ title, level }));
            const itemsPerUniverse = {};
            /* Because Tiptap rendering cannot be async, we extract the links we'll need to check ahead of time. */
            await Promise.all(links.map(async (link) => {
                if (link.item) {
                    const universeShort = link.universe ?? story.universe_short;
                    if (!(universeShort in itemsPerUniverse)) {
                        itemsPerUniverse[universeShort] = {};
                    }
                    if (!(link.item in itemsPerUniverse[universeShort])) {
                        itemsPerUniverse[universeShort][link.item] = await api_1.default.item.exists(req.session.user, universeShort, link.item);
                    }
                }
            }));
            const renderContext = {
                currentUniverse: story.universe_short,
                universeLink: (universeShort) => (0, templates_1.universeLink)(req, universeShort),
                itemExists: (universe, item) => (universe in itemsPerUniverse) && itemsPerUniverse[universe][item],
                headings,
            };
            const htmlBody = (0, html_string_1.renderToHTMLString)({ extensions: (0, editor_1.editorExtensions)(false, renderContext), content: jsonBody });
            const sanitizedHtml = (0, sanitize_html_1.default)(htmlBody, {
                allowedTags: sanitize_html_1.default.defaults.allowedTags.concat(['img']),
                allowedAttributes: {
                    ...sanitize_html_1.default.defaults.allowedAttributes,
                    img: ['src', 'alt', 'title', 'width', 'height'],
                    h1: ['id'], h2: ['id'], h3: ['id'], h4: ['id'], h5: ['id'], h6: ['id'],
                },
                disallowedTagsMode: 'escape',
                allowedClasses: {
                    '*': false,
                },
            });
            renderedBody = {
                type: 'html',
                content: sanitizedHtml,
            };
        }
        catch (err) {
            logger_1.default.error('Failed to parse chapter body:');
            logger_1.default.error(err);
            renderedBody = { type: 'text', content: chapter.body };
        }
        res.prepareRender('chapter', {
            story, chapter, comments, commenters, renderedBody,
            commentAction: `${config_1.ADDR_PREFIX}/stories/${story.shortname}/${chapter.chapter_number}/comment`,
        });
    },
    async deleteChapter(req, res) {
        try {
            const chapter = await api_1.default.story.getChapter(req.session.user, req.params.shortname, Number(req.params.index), utils_1.perms.OWNER);
            res.prepareRender('deleteChapter', { chapter, storyShort: req.params.shortname });
        }
        catch (err) {
            if (err instanceof errors_1.NotFoundError) {
                return res.redirect(`${config_1.ADDR_PREFIX}/stories/${req.params.shortname}`);
            }
            throw err;
        }
    },
};
