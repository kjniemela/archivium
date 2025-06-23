"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = __importDefault(require("../api"));
const config_1 = require("../config");
const createSession = async (req, res, next) => {
    if (req.cookies['archiviumuid']) {
        const session = await api_1.default.session.getOne({ hash: req.cookies['archiviumuid'] });
        if (session) {
            req.session = {
                id: session.id,
                hash: session.hash
            };
            if (session.user) {
                req.session = {
                    ...req.session,
                    userId: session.userId,
                    user: session.user,
                };
            }
            next();
            return;
        }
    }
    const { insertId } = await api_1.default.session.post();
    const session = await api_1.default.session.getOne({ id: insertId });
    res.cookie('archiviumuid', session.hash, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });
    req.session = {
        id: session.id,
        hash: session.hash
    };
    next();
};
/************************************************************/
// Add additional authentication middleware functions below
/************************************************************/
async function refreshSession(user) {
    await api_1.default.user.put(user.id, user.id, { updated_at: new Date() });
}
const verifySession = async (req, res, next) => {
    const user = req.session.user;
    if (user && user.verified) {
        await refreshSession(user);
        next();
    }
    else {
        res.sendStatus(401);
    }
};
const verifySessionOrRedirect = async (req, res, next) => {
    const user = req.session.user;
    if (user && user.verified) {
        await refreshSession(user);
        next();
    }
    else {
        const searchQueries = new URLSearchParams(req.query);
        const pageQuery = new URLSearchParams();
        pageQuery.append('page', req.path);
        if (searchQueries.toString())
            pageQuery.append('search', searchQueries.toString());
        if (user && !user.verified) {
            res.redirect(`${config_1.ADDR_PREFIX}/verify?${pageQuery.toString()}`);
        }
        else {
            res.redirect(`${config_1.ADDR_PREFIX}/login?${pageQuery.toString()}`);
        }
    }
};
exports.default = {
    createSession,
    verifySession,
    verifySessionOrRedirect,
};
