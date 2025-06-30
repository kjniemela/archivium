import db from '../db';
import _ from 'lodash';
import md5 from 'md5';
import logger from '../logger';
import { QueryResult, RowDataPacket } from 'mysql2/promise';

export enum perms {
  NONE,
  READ,
  COMMENT,
  WRITE,
  ADMIN,
  OWNER,
}

export enum plans {
  FREE,
  PREMIUM,
  BETA,
  SUPER,
}

export const paidTiers = {
  PREMIUM: 1,
} as const;
type ValueOf<T> = T[keyof T];
type PaidTier = ValueOf<typeof paidTiers>;

export const tiers = {
  FREE: 0,
  ...paidTiers,
} as const;

export const tierAllowance: Record<plans, Record<PaidTier | 'total', number>> = {
  [plans.FREE]: { total: 5, [tiers.PREMIUM]: 0 },
  [plans.PREMIUM]: { total: 20, [tiers.PREMIUM]: 5 },
  [plans.BETA]: { total: 5, [tiers.PREMIUM]: 1 },
  [plans.SUPER]: { total: 999, [tiers.PREMIUM]: 99  },
};

export async function executeQuery<T extends QueryResult = RowDataPacket[]>(query: string, values: any[]) {
  const [ results ] = await db.execute<T>(query, values);
  return results;
}

export class RollbackError extends Error {}

export async function withTransaction(callback) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    await callback(connection);

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

export const parseData = (conditions: { [key: string]: any }) => {
  const keys = Object.keys(conditions).filter(key => conditions[key] !== undefined);
  const values = keys.map(key => conditions[key]);
  const strings = keys.map(key => `${key as string} = ?`);
  return { strings, values };
}

type SelectCol = string | string[] | SelectParams[];
type SelectParams = [SelectCol, string | null, string | null] | [SelectCol, string | null] | [SelectCol];

export type Result<T> = Promise<[number, T?]>;

export class QueryBuilder {
   table: string | null;
   selects: {};
   selectValues: {};
   joins: any[];
   whereCond: Cond | null;
   groups: {};
   order: any[];
   orderDesc: any[];
   resultLimit: number | null;
   unions: any[];

   constructor() {
    this.table = null;
    this.selects = {};
    this.selectValues = {};
    this.joins = [];
    this.whereCond = null;
    this.groups = {};
    this.order = [];
    this.orderDesc = [];
    this.resultLimit = null;
    this.unions = [];
   }

   select(...args: SelectParams) {
    const [col, selectAs, value] = args;
    if (col instanceof Array) {
      col.forEach((args: string | SelectParams) => {
        if (args instanceof Array) this.select(...args);
        else this.select(args);
      });
    } else {
      this.selects[col] = selectAs;
      this.selectValues[col] = value;
    }
    return this;
   }

   from(table) {
    this.table = table;
    return this;
   }

   join(type, table, on) {
    this.joins.push([type, table, on]);
   }

   innerJoin(table, on) {
    this.join('INNER', table, on);
    return this;
   }

   leftJoin(table, on) {
    this.join('LEFT', table, on);
    return this;
   }

   where(cond) {
    if ((cond instanceof MultiCond || cond.check)) this.whereCond = cond;
    return this;
   }

   groupBy(col) {
    if (col instanceof Array) col.forEach(args => this.groupBy(args));
    else this.groups[col] = true;
    return this;
   }

   orderBy(col, orderDesc=false) {
    this.order.push(col);
    this.orderDesc.push(orderDesc);
    return this;
   }

   limit(l) {
    this.resultLimit = l;
    return this;
   }

   union(query) {
    this.unions.push(query);
    return this;
   }

   compile(): [string, any[]] {
    const selectCols = Object.keys(this.selects);
    let queryStr = '';
    let values: any[] = [];
    if (selectCols.length) {
      if (!this.table) throw 'No table specified!';
      queryStr += `SELECT ${selectCols.map(col => {
        if (this.selectValues[col]) {
          if (this.selectValues[col] instanceof Array) values = [...values, ...this.selectValues[col]];
          else values = [...values, this.selectValues[col]];
        }
        if (this.selects[col]) return `${col} AS ${this.selects[col]}`;
        else return col;
      }).join(', ')}`;
      queryStr += ` FROM ${this.table}`;
      for (const [type, table, on] of this.joins) {
        const tableStr = table instanceof Array ? table.join(' AS ') : table;
        queryStr += ` ${type} JOIN ${tableStr}`;
        if (on && on instanceof Cond) {
          const [str, vals] = on.export();
          queryStr += ` ON ${str}`;
          values = [...values, ...vals.filter(val => val !== undefined)];
        }
      }
      if (this.whereCond) {
        const [str, vals] = this.whereCond.export();
        queryStr += ` WHERE ${str}`;
        values = [...values, ...vals.filter(val => val !== undefined)];
      }
      const groupCols = Object.keys(this.groups);
      if (groupCols.length > 0) {
        queryStr += ` GROUP BY ${groupCols.join(', ')}`;
      }
      if (this.order.length) {
        const orderStr = this.order.map((col, i) => `${col} ${this.orderDesc[i] ? 'DESC' : 'ASC'}`);
        queryStr += ` ORDER BY ${orderStr}`;
      }
      if (this.resultLimit) {
        queryStr += ` LIMIT ${this.resultLimit}`;
      }
    } else if (this.unions.length) {
      const unionData = this.unions.map(query => query.compile());
      const strs: string[] = [];
      for (const [str, vals] of unionData) {
        strs.push(str);
        values = values.concat(vals);
      }
      queryStr += strs.join(' UNION ');
    }
    return [queryStr, values];
   }

   async execute() {
    const [queryStr, values] = this.compile();
    return await executeQuery(queryStr, values);
   }
}

export class Cond {
  check?: string;
  value?: any;
  constructor(check?: string, value?: any) {
    this.check = check;
    this.value = value;
  }

  or(cond?: string | Cond, value=undefined) {
    if (!(cond instanceof Cond)) return this.or(new Cond(cond, value));
    if (cond && !(cond.check || cond instanceof MultiCond)) return this;
    return new MultiCond('OR', this, cond);
  }

  and(cond?: string | Cond, value=undefined) {
    if (!(cond instanceof Cond)) return this.and(new Cond(cond, value));
    if (cond && !(cond.check || cond instanceof MultiCond)) return this;
    return new MultiCond('AND', this, cond);
  }

  export(): [string | undefined, any[]] {
    return [this.check, [this.value]];
  }
}

export type CondType = 'AND' | 'OR';

class MultiCond extends Cond {
  type: CondType;
  a: Cond;
  b: Cond;
  constructor(type: CondType, a: Cond, b: Cond) {
    super();
    this.type = type;
    this.a = a;
    this.b = b;
  }

  export(): [string, any[]] {
    const [aStr, aValues] = this.a.export();
    const [bStr, bValues] = this.b.export();
    if (!(aStr && bStr)) return [`${aStr || bStr || ''}`, [...aValues, ...bValues]];
    return [`(${aStr} ${this.type} ${bStr})`, [...aValues, ...bValues]];
  }
}

export function getPfpUrl(user) {
  return user.hasPfp ? `/api/users/${user.username}/pfp` : `https://www.gravatar.com/avatar/${md5(user.email)}.jpg`;
}
