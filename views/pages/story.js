const { ADDR_PREFIX } = require('../../config');
const api = require('../../api');
const { universeLink } = require('../../templates');
const { perms, getPfpUrl } = require('../../api/utils');
const logger = require('../../logger');

module.exports = {
  async list(req, res) {
    const search = req.query.search;
    const [code, stories] = await api.story.getMany(
      req.session.user,
      search ? { strings: ['title LIKE ?'], values: [`%${search}%`] } : null,
      perms.READ,
      {
        sort: req.query.sort,
        sortDesc: req.query.sort_order === 'desc',
      },
    );
    res.status(code);
    if (!stories) return;
    res.prepareRender('storyList', { stories, search });
  },

  async create(req, res) {
    const [code, universes] = await api.universe.getMany(req.session.user, null, perms.WRITE);
    res.status(code);
    if (code !== 200) return;
    res.prepareRender('createStory', { universes });
  },
  
  async view(req, res) {
    const [code, story] = await api.story.getOne(req.session.user, { 'story.shortname': req.params.shortname });
    res.status(code);
    if (!story) return;
    res.prepareRender('story', { story });
  },

  async delete(req, res) {
    const [code, universe] = await api.universe.getOne(req.session.user, { shortname: req.params.universeShortname }, perms.OWNER);
    res.status(code);
    if (!universe) return res.redirect(`${ADDR_PREFIX}/universes`);
    res.prepareRender('deleteUniverse', { universe });
  },

  async edit(req, res, error, body) {
    const [code, fetchedUniverse] = await api.universe.getOne(req.session.user, { shortname: req.params.universeShortname }, perms.WRITE);
    res.status(code);
    if (!fetchedUniverse) return;
    const universe = {...fetchedUniverse, ...(body ?? {}), shortname: fetchedUniverse.shortname, newShort: body?.shortname ?? fetchedUniverse.shortname};
    res.prepareRender('editUniverse', { universe, error });
  },
  
  async viewChapter(req, res) {
    const [code1, story] = await api.story.getOne(req.session.user, { 'story.shortname': req.params.shortname });
    res.status(code1);
    if (!story) return;
    const [code2, chapter] = await api.story.getChapter(req.session.user, story.shortname, req.params.index);
    res.status(code2);
    if (!chapter) return;
    res.prepareRender('chapter', { story, chapter, comments: [] });
  },
};
