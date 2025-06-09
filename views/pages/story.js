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
    const [code1, universe] = await api.universe.getOne(req.session.user, { shortname: req.params.universeShortname });
    res.status(code1);
    if (code1 === 403 || code1 === 401) {
      const [code, publicBody] = await api.universe.getPublicBodyByShortname(req.params.universeShortname);
      if (!publicBody && code1 === 401) {
        res.status(code);
        req.forceLogin = true;
        req.useExQuery = true;
        return;
      }
      res.status(200);
      const [, request] = await api.universe.getUserAccessRequest(req.session.user, req.params.universeShortname);
      return res.prepareRender('privateUniverse', { shortname: req.params.universeShortname, hasRequested: Boolean(request), publicBody });
    }
    else if (!universe) return;
    const [code2, authors] = await api.user.getByUniverseShortname(req.session.user, universe.shortname);
    res.status(code2);
    if (!authors) return;
    const authorMap = {};
    authors.forEach(author => {
      authorMap[author.id] = {
        ...author,
        pfpUrl: getPfpUrl(author),
      };
    });
    const [code3, threads] = await api.discussion.getThreads(req.session.user, { 'discussion.universe_id': universe.id }, false, true);
    if (!threads) return res.status(code3);
    const [code4, counts] = await api.item.getCountsByUniverse(req.session.user, universe, false);
    if (!counts) return res.status(code4);
    res.prepareRender('universe', { universe, authors: authorMap, threads, counts });
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
};
