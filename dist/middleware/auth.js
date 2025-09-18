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
                hash: session.hash,
                created_at: session.created_at,
            };
            if (session.user) {
                req.session = {
                    ...req.session,
                    user_id: session.user_id,
                    user: session.user,
                };
            }
            next();
            return;
        }
    }
    const { insertId } = await api_1.default.session.post();
    const session = await api_1.default.session.getOne({ id: insertId }); // We just created this session, so it must exist.
    res.cookie('archiviumuid', session.hash, {
        httpOnly: true,
        secure: true,
        sameSite: config_1.DEV_MODE ? 'none' : 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });
    req.session = {
        id: session.id,
        hash: session.hash,
        created_at: session.created_at,
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
const bypassEmailVerification = async (req, res, next) => {
    const user = req.session.user;
    if (user) {
        user.verified = true;
    }
    next();
};
exports.default = {
    createSession,
    verifySession,
    verifySessionOrRedirect,
    bypassEmailVerification,
};
