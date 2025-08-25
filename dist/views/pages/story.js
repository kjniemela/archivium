"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = __importDefault(require("../../api"));
const utils_1 = require("../../api/utils");
const config_1 = require("../../config");
const errors_1 = require("../../errors");
const renderContent_1 = require("../../lib/renderContent");
const locale_1 = require("../../locale");
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
        let renderedBody = await (0, renderContent_1.tryRenderContent)(req, chapter.body, story.universe_short);
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
