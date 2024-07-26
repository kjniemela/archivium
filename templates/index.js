const pug = require('pug');
const { ADDR_PREFIX } = require('../config');

// Basic context information to be sent to the templates
function contextData(req) {
  const user = req.session.user;
  const contextUser = user ? { id: user.id, username: user.username } : null;
  return {
    contextUser,
    ADDR_PREFIX,
  };
}

// compile templates
const templates = {
  error: pug.compileFile('templates/error.pug'),
  home: pug.compileFile('templates/home.pug'),
  login: pug.compileFile('templates/login.pug'),
  signup: pug.compileFile('templates/signup.pug'),

  universe: pug.compileFile('templates/view/universe.pug'),
  editUniverse: pug.compileFile('templates/edit/universe.pug'),
  universeList: pug.compileFile('templates/list/universes.pug'),

  item: pug.compileFile('templates/view/item.pug'),
  editItem: pug.compileFile('templates/edit/item.pug'),
  itemList: pug.compileFile('templates/list/items.pug'),

  universeItemList: pug.compileFile('templates/list/universeItems.pug'),

  user: pug.compileFile('templates/view/user.pug'),
  userList: pug.compileFile('templates/list/users.pug'),
};

function render(req, template, context = {}) {
  if (template in templates) return templates[template]({ ...context, ...contextData(req) });
  else return templates.error({
    code: 404,
    hint: 'Could this be the page you\'re looking for?',
    hintLink: `${ADDR_PREFIX}/universes/${item.universeId}/items/${item.id}`,
    ...contextData(req)
  });
}

module.exports = {
  render,
};