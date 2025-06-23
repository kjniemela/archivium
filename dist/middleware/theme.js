const themes = require("../themes");
const setTheme = (req, _, next) => {
    const user = req.session.user;
    req.theme = themes[user?.preferred_theme] ?? themes.default;
    next();
};
module.exports = setTheme;
