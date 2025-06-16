const db = require('../db');
const _ = require('lodash');
const md5 = require('md5');
const logger = require('../logger');

const perms = {
  NONE: 0,
  READ: 1,
  COMMENT: 2,
  WRITE: 3,
  ADMIN: 4,
  OWNER: 5,
};

const tiers = {
  FREE: 0,
  PREMIUM: 1,
  BETA: 2,
  SUPER: 3,
};

async function executeQuery(query, values) {
  const [ results ] = await db.execute(query, values);
  return results;
}

class RollbackError extends Error {}

async function withTransaction(callback) {
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

const parseData = (options) => {
  return _.reduce(options, (parsed, value, key) => {
    parsed.strings.push(`${key} = ?`);
    parsed.values.push(value);
    return parsed;
  }, { strings: [], values: [] });
};

class QueryBuilder {
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

   select(col, selectAs=null, value=null) {
    if (col instanceof Array) {
      col.forEach(args => {
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

   compile() {
    const selectCols = Object.keys(this.selects);
    let queryStr = '';
    let values = [];
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
      const strs = [];
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

class Cond {
  constructor(check, value=undefined) {
    this.check = check;
    this.value = value;
  }

  or(cond, value=undefined) {
    if (!(cond instanceof Cond)) return this.or(new Cond(cond, value));
    if (cond && !(cond.check || cond instanceof MultiCond)) return this;
    return new MultiCond('OR', this, cond);
  }

  and(cond, value=undefined) {
    if (!(cond instanceof Cond)) return this.and(new Cond(cond, value));
    if (cond && !(cond.check || cond instanceof MultiCond)) return this;
    return new MultiCond('AND', this, cond);
  }

  export() {
    return [this.check, [this.value]];
  }
}

class MultiCond extends Cond {
  constructor(type, a, b) {
    super();
    this.type = type;
    this.a = a;
    this.b = b;
  }

  export() {
    const [aStr, aValues] = this.a.export();
    const [bStr, bValues] = this.b.export();
    if (!(aStr && bStr)) return [`${aStr || bStr || ''}`, [...aValues, ...bValues]];
    return [`(${aStr} ${this.type} ${bStr})`, [...aValues, ...bValues]];
  }
}

function getPfpUrl(user) {
  return user.hasPfp ? `/api/users/${user.username}/pfp` : `https://www.gravatar.com/avatar/${md5(user.email)}.jpg`;
}

module.exports = {
  perms,
  tiers,
  executeQuery,
  RollbackError,
  withTransaction,
  parseData,
  QueryBuilder,
  Cond,
  getPfpUrl,
};
