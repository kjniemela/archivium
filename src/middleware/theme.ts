import { RequestHandler } from "express";
import themes, { themeAvailable } from "../themes";
import { planTier } from "../api/utils";

const setTheme: RequestHandler = (req, _, next) => {
  const user = req.session.user;
  if (user) {
    const preferredTheme = user.preferred_theme;
    if (preferredTheme && themeAvailable(preferredTheme, planTier(user.plan))) {
      req.theme = (preferredTheme === 'custom' ? user.custom_theme : themes[preferredTheme]) ?? themes.default;
    } else {
      req.theme = themes.default;
    }
  }
  next();
};

export default setTheme;
