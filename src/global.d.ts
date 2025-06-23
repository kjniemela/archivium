import { Request, Response } from 'express';
import { Theme } from './themes';

declare global {
  namespace Express {
    interface Request {
      session: any,
      startTime: Date,
      clientIp?: string,
      loginId?: number,
      isApiRequest: boolean,
      theme: Theme,
      forceLogin: boolean,
      useExQuery: boolean,
      targetPage?: string,
    }

    interface Response {
      prepareRender: (template: string, data?: { [key: string]: any }) => void,
      templateData: { template: string, data: { [key: string]: any } },
      error?: string,
    }
  }
}
