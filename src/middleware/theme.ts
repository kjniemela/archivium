import { RequestHandler } from "express";
import themes from "../themes";

const setTheme: RequestHandler = (req, _, next) => {
  const user = req.session.user;
  req.theme = themes[user?.preferred_theme] ?? themes.default;
  next();
};

export default setTheme;
  