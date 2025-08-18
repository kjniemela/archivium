import { RequestHandler } from "express";
import themes from "../themes";

const setTheme: RequestHandler = (req, _, next) => {
  const user = req.session.user;
  if (user) {
    const customTheme = user.custom_theme;
    const baseTheme = user.preferred_theme ? themes[user.preferred_theme] : null;
    req.theme = (user.preferred_theme === 'custom' ? customTheme : baseTheme) ?? themes.default;
  }
  next();
};

export default setTheme;
  