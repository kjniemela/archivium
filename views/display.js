const { ADDR_PREFIX, DEV_MODE } = require('../config');
const Auth = require('../middleware/auth');
const api = require('../api');
const md5 = require('md5');
const { perms, Cond } = require('../api/utils');
const fs = require('fs/promises');
const logger = require('../logger');

module.exports = function({ get, post, put }) {
  get('/display/:shortname', async (req, res) => {
    const [code1, universe] = await api.universe.getOne(req.session.user, { shortname: req.params.shortname });
    res.status(code1);
    if (!universe) return;
    const [code2, authors] = await api.user.getByUniverseShortname(req.session.user, universe.shortname);
    res.status(code2);
    if (!authors) return;
    const authorMap = {};
    authors.forEach(author => {
      authorMap[author.id] = {
        ...author,
        gravatarLink: `https://www.gravatar.com/avatar/${md5(author.email)}.jpg`,
      };
    });
    const [code3, threads] = await api.discussion.getThreads(req.session.user, { 'discussion.universe_id': universe.id }, false, true);
    if (!threads) return [code3];
    res.prepareRender('universe', { universe, authors: authorMap, threads });
  });
}