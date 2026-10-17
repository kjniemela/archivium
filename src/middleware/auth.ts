import { NextFunction, Request, Response } from 'express';
import api from '../api';
import { Session } from '../api/models/session';
import { UserRef } from '../api/models/user';
import { DEV_MODE } from '../config';

const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
// const SESSION_REFRESH_THRESHOLD_MS = 1000 * 60 * 60 * 24; // 1 day // TODO, implement session refresh (?)

export async function getSessionFromHash(hash?: string, returnStale=false) {
  if (!hash) return null;
  const session = await api.session.getOne({ hash });
  if (!session) return null;
  if (Date.now() - session.created_at.getTime() >= SESSION_LIFETIME_MS) return returnStale ? session : null;
  return session;
}

const setSessionCookie = (res: Response, hash: string) => {
  res.cookie('archiviumuid', hash, {
    httpOnly: true,
    secure: true,
    sameSite: DEV_MODE ? 'none' : 'lax',
    maxAge: SESSION_LIFETIME_MS,
  });
};

const createSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  req.session = {};
  const hash = req.cookies['archiviumuid'];
  if (!hash) return next();

  const session = await getSessionFromHash(req.cookies['archiviumuid'], true);
  if (!session) return next();

  const sessionAge = new Date().getTime() - session.created_at.getTime();
  if (sessionAge < SESSION_LIFETIME_MS) {
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
    return next();
  }

  // Session is older than 7 days, it needs to be replaced
  if (session.user_id) {
    const fresh = await newSession(req, res);
    await api.session.put({ id: fresh.id }, { user_id: session.user_id });
    req.session = { ...req.session, user_id: session.user_id, user: session.user };
  }
  await api.session.del({ id: session.id });
  next();
};

async function newSession(req: Request, res: Response): Promise<Session> {
  const { insertId } = await api.session.post();
  const session = await api.session.getOne({ id: insertId }) as Session; // We just created this session, so it must exist.
  setSessionCookie(res, session.hash);
  req.session = {
    id: session.id,
    hash: session.hash,
    created_at: session.created_at,
  };
  return session;
}

const ensureSession = async (req: Request, res: Response): Promise<number> => {
  if (req.session.id !== undefined) return req.session.id;
  return (await newSession(req, res)).id;
};

async function refreshSession(user: UserRef) {
  await api.user.put(user.id, user.id, { updated_at: new Date() });
}

const verifySession = async (req: Request, res: Response, next: NextFunction) => {
  const user = req.session.user;
  if (user && user.verified) {
    await refreshSession(user);
    next();
  } else {
    res.sendStatus(401);
  }
}

const verifySessionOrRedirect = async (req: Request, res: Response, next: NextFunction) => {
  const user = req.session.user;
  if (user && user.verified) {
    await refreshSession(user);
    next();
  } else {
    const searchQueries = new URLSearchParams(req.query as Record<string, string>);
    const pageQuery = new URLSearchParams();
    pageQuery.append('page', req.path);
    if (searchQueries.toString()) pageQuery.append('search', searchQueries.toString());
    if (user && !user.verified) {
      res.redirect(`/verify?${pageQuery.toString()}`);
    } else {
      res.redirect(`/login?${pageQuery.toString()}`);
    }
  }
}

const bypassEmailVerification = async (req: Request, _res: Response, next: NextFunction) => {
  const user = req.session.user;
  if (user) {
    user.verified = true;
  }
  next();
}

export default {
  createSession,
  verifySession,
  verifySessionOrRedirect,
  bypassEmailVerification,
  ensureSession,
};
