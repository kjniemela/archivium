"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const themes_1 = __importDefault(require("../themes"));
const setTheme = (req, _, next) => {
    const user = req.session.user;
    if (user) {
        const customTheme = user.custom_theme;
        const baseTheme = user.preferred_theme ? themes_1.default[user.preferred_theme] : null;
        req.theme = (user.preferred_theme === 'custom' ? customTheme : baseTheme) ?? themes_1.default.default;
    }
    next();
};
exports.default = setTheme;
