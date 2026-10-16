import express from 'express';

const parseCookies = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  req.cookies = {};

  if ('cookie' in req.headers) {
    for (const cookie of req.headers.cookie?.split('; ') ?? []) {
      const [key, value] = cookie.split('=');
      req.cookies[key] = value;
    }
  }
  next()
};

export default parseCookies;
