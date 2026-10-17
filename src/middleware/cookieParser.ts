import type { Request, Response, NextFunction } from 'express';

export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const cookie of header.split('; ')) {
    const [key, value] = cookie.split('=');
    cookies[key] = value;
  }
  return cookies;
}

export default (req: Request, _res: Response, next: NextFunction) => {
  req.cookies = parseCookies(req.headers.cookie);
  next();
};
