import { Express } from 'express-serve-static-core';
import { Theme } from './themes';
import { Session } from './api/models/session';

declare module 'express-serve-static-core' {
  interface Request extends Request {
    session: Session,
    startTime: Date,
    clientIp?: string,
    loginId?: number,
    isApiRequest: boolean,
    theme: Theme,
    forceLogin: boolean,
    useExQuery: boolean,
    targetPage?: string,
    getQueryParam: (key: string) => string | undefined,
    getQueryParamAsNumber: (key: string) => number | undefined,
  }

  interface Response extends Response {
    prepareRender: (template: string, data?: { [key: string]: any }) => void,
    templateData: { template: string, data: { [key: string]: any } },
    error?: string,
  }
}
