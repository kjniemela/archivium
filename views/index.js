const { ADDR_PREFIX } = require('../config');
const { render } = require('../templates');
const logger = require('../logger');

module.exports = function(app) {
  app.use((req, res, next) => {
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.prepareRender = (template, data={}) => {
      res.templateData = [template, data];
    };
    next();
  });

  const doRender = (req, res, next) => {
    if (res.statusCode === 302) return next(); // We did a redirect, no need to render.
    try {
      const [template, data] = res.templateData;
      res.end(render(req, template, data));
    } catch (err) {
      logger.error(`Error ${res.statusCode} rendered.`);
      logger.debug(err.toString());
      res.end(render(req, 'error', { code: res.statusCode }));
    }
    next();
  };
  
  function use(method, path, ...middleware) {
    const handler = middleware.pop();
    if (!(['get', 'post', 'put'].includes(method))) throw `Illegal method: ${method}`;
    app[method](`${ADDR_PREFIX}${path}`, ...middleware, async (req, res, next) => {
      await handler(req, res);
      next();
    }, doRender);
  }
  
  const get = (...args) => use('get', ...args);
  const post = (...args) => use('post', ...args);
  const put = (...args) => use('put', ...args);
  const methods = { get, post, put };

  require('./views')(methods);
  require('./display')(methods);
}