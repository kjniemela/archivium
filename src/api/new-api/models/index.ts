import { ResultSetHeader, PoolConnection, Pool } from 'mysql2/promise';
import db from '../../../db';
import logger from '../../../logger';

async function executeQuery<T>(conn: PoolConnection | Pool, sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await conn.execute(sql, params);
  return rows as T[];
}

export class RollbackError extends Error {}

export interface Transaction {
  connection: PoolConnection;
  query<T>(sql: string, params: any[]): Promise<T[]>;
}

export abstract class Model {
  static readonly TABLE: string;

  protected static query<T>(sql: string, params: any[] = []): Promise<T[]> {
    return executeQuery<T>(db, sql, params);
  }

  protected static async withTransaction(callback: (conn: Transaction) => Promise<void>) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
  
      await callback({
        connection,
        query(sql, params = []) {
          return executeQuery(connection, sql, params);
        },
      });
  
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      logger.warn('Transaction rolled back.');
      if (!(err instanceof RollbackError)) {
        throw err;
      }
    } finally {
      connection.release();
    }
  }

  protected static async insert<T>(table: string, fields: Partial<T>): Promise<ResultSetHeader> {
    const keys = Object.keys(fields).filter(key => fields[key] !== undefined) as (keyof T)[];
    const values = keys.map(key => fields[key]);
    const data = await db.execute(`
      INSERT INTO ${table}
      (${keys.join(', ')})
      VALUES (${keys.map(() => '?').join(', ')})
    `, values);
    const resultSetHeader = data[0] as ResultSetHeader;
    return resultSetHeader;
  }

  protected static async update<T>(table: string, id: number, fields: Partial<T>): Promise<ResultSetHeader> {
    const keys = Object.keys(fields).filter(key => fields[key] !== undefined) as (keyof T)[];
    const values = keys.map(key => fields[key]);
    const data = await db.execute(`
      UPDATE ${table}
      SET
        ${keys.map(key => `${key as string} = ?`).join(', ')}
      WHERE id = ?
    `, [...values, id]);
    console.log(data)
    const resultSetHeader = data[0] as ResultSetHeader;
    return resultSetHeader;
  }

  protected static parseConditions<T>(conditions: Partial<T>): [string, Partial<T>[keyof T][]] {
    const keys = Object.keys(conditions).filter(key => conditions[key] !== undefined) as (keyof T)[];
    const values = keys.map(key => conditions[key]);
    const keyStr = keys.map(key => `${key as string} = ?`).join(' AND ');
    return [keyStr, values];
  }

  abstract save(): Promise<void>;
  abstract delete(): Promise<void>;
}

export * from './user';
