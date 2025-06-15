const { themes } = require("../templates");

const setTheme = (req, _, next) => {
  const user = req.session.user;
  req.theme = themes[user?.theme] ?? themes.default;
  next();
};

module.exports = setTheme;
  