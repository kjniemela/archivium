"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../../config");
const api_1 = __importDefault(require("../../api"));
const utils_1 = require("../../api/utils");
const locale_1 = require("../../locale");
exports.default = {
    async list(req, res) {
        const search = req.query.search;
        const [code, stories] = await api_1.default.story.getMany(req.session.user, null, utils_1.perms.READ, {
            sort: req.query.sort,
            sortDesc: req.query.sort_order === 'desc',
            search,
        });
        res.status(code);
        if (!stories)
            return;
        res.prepareRender('storyList', { stories, search });
    },
    async create(req, res) {
        const [code, universes] = await api_1.default.universe.getMany(req.session.user, null, utils_1.perms.WRITE);
        res.status(code);
        if (code !== 200)
            return;
        res.prepareRender('createStory', { universes });
    },
    async view(req, res) {
        const [code, story] = await api_1.default.story.getOne(req.session.user, { 'story.shortname': req.params.shortname });
        res.status(code);
        if (!story)
            return;
        res.prepareRender('story', { story });
    },
    async delete(req, res) {
        const [code, story] = await api_1.default.story.getOne(req.session.user, { 'story.shortname': req.params.shortname }, utils_1.perms.OWNER);
        res.status(code);
        if (!story)
            return res.redirect(`${config_1.ADDR_PREFIX}/stories`);
        res.prepareRender('deleteStory', { story });
    },
    async edit(req, res, error, body) {
        const [code, fetchedStory] = await api_1.default.story.getOne(req.session.user, { 'story.shortname': req.params.shortname }, utils_1.perms.WRITE);
        res.status(code);
        if (!fetchedStory)
            return;
        const story = { ...fetchedStory, ...(body ?? {}), shortname: fetchedStory.shortname, newShort: body?.shortname ?? fetchedStory.shortname };
        res.prepareRender('editStory', { story, error });
    },
    async createChapter(req, res) {
        const [code, story] = await api_1.default.story.getOne(req.session.user, { 'story.shortname': req.params.shortname });
        res.status(code);
        if (!story)
            return;
        const title = `${(0, locale_1.T)('Untitled Chapter')} ${story.chapter_count + 1}`;
        const [code2, data, index] = await api_1.default.story.postChapter(req.session.user, story.shortname, { title });
        res.status(code2);
        if (!data)
            return;
        return res.redirect(`${config_1.ADDR_PREFIX}/stories/${story.shortname}/${index}/edit`);
    },
    async viewChapter(req, res) {
        const [code1, story] = await api_1.default.story.getOne(req.session.user, { 'story.shortname': req.params.shortname });
        res.status(code1);
        if (!story)
            return;
        const [code2, chapter] = await api_1.default.story.getChapter(req.session.user, story.shortname, req.params.index);
        res.status(code2);
        if (!chapter)
            return;
        const [code3, comments, commentUsers] = await api_1.default.discussion.getCommentsByChapter(chapter.id, true);
        if (!comments || !commentUsers) {
            res.status(code3);
            return;
        }
        const commenters = {};
        for (const user of commentUsers) {
            user.pfpUrl = (0, utils_1.getPfpUrl)(user);
            delete user.email;
            commenters[user.id] = user;
        }
        res.prepareRender('chapter', {
            story, chapter, comments, commenters,
            commentAction: `${config_1.ADDR_PREFIX}/stories/${story.shortname}/${chapter.chapter_number}/comment`,
        });
    },
    async deleteChapter(req, res) {
        const [code, chapter] = await api_1.default.story.getChapter(req.session.user, req.params.shortname, req.params.index, utils_1.perms.OWNER);
        res.status(code);
        if (!chapter)
            return res.redirect(`${config_1.ADDR_PREFIX}/stories/${req.params.shortname}`);
        chapter.storyShort = req.params.shortname;
        res.prepareRender('deleteChapter', { chapter });
    },
    async editChapter(req, res, error, body) {
        const [code1, story] = await api_1.default.story.getOne(req.session.user, { 'story.shortname': req.params.shortname }, utils_1.perms.WRITE);
        res.status(code1);
        if (!story)
            return;
        const [code2, fetchedChapter] = await api_1.default.story.getChapter(req.session.user, req.params.shortname, req.params.index, utils_1.perms.WRITE);
        res.status(code2);
        if (!fetchedChapter)
            return;
        const chapter = { ...fetchedChapter, ...(body ?? {}) };
        res.prepareRender('editChapter', { story, chapter, error });
    },
};
