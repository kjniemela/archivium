import { executeQuery, parseData } from '../utils';
import { API } from '..';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { NotFoundError } from '../../errors';

export type Newsletter = {
  id: number;
  title: string;
  preview: string;
  body: string;
  created_at: Date;
} & RowDataPacket;

export type NewsletterConditions = {
  id?: number;
  title?: string;
  preview?: string;
  body?: string;
  created_at?: Date;
};

export type NewsletterCreateData = {
  title: string;
  preview: string;
  body: string;
};

export class NewsletterAPI {
  readonly api: API;

  constructor(api: API) {
    this.api = api;
  }

  /**
   * These methods should only be called from scripts or safe routes, no validation is being done here!
   */

  async getOne(id: number): Promise<Newsletter> {
    const newsletters = await this.getMany({ id });
    const newsletter = newsletters[0];
    if (!newsletter) throw new NotFoundError('Newsletter not found');
    return newsletter;
  }

  async getMany(conditions?: NewsletterConditions): Promise<Newsletter[]> {
    const parsedConds = parseData(conditions ?? {});
    const subscription = await executeQuery<Newsletter[]>(`
        SELECT *
        FROM newsletter
        ${conditions ? `WHERE ${parsedConds.strings.join(' AND ')}` : ''}
        ORDER BY created_at DESC
      `, parsedConds.values);
    return subscription;
  }

  async post({ title, preview, body }: NewsletterCreateData): Promise<ResultSetHeader> {
    const queryString = `INSERT INTO newsletter (title, preview, body, created_at) VALUES (?, ?, ?, ?);`;
    return await executeQuery<ResultSetHeader>(queryString, [title, preview, body, new Date()]);
  }
} 