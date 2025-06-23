import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      session: any,
      startTime: Date,
      clientIp?: string,
      loginId?: number,
      isApiRequest: boolean,
    }
  }
}
