import type { Request, Response } from 'express';
import md5 from 'md5';
import { RequestError } from '../errors';
import logger from '../logger';
import { SqlBool } from 'kysely';
import { kysely, Trx } from '../db/kysely';

export { perms } from '../lib/perms';

export enum plans {
  FREE,
  PREMIUM,
  BETA,
  PREMIUM_BETA,
  SUPER,
}

import { paidTiers, tiers } from '../lib/tiers';
import type { PaidTier, Tier } from '../lib/tiers';
import { CommenterUser, CommenterUserRaw } from './models/discussion';
export { paidTiers, tiers };
export type { PaidTier, Tier };

export const tierAllowance: Record<plans, Record<PaidTier | 'total', number>> = {
  [plans.FREE]: { total: 5, [tiers.PREMIUM]: 0 },
  [plans.PREMIUM]: { total: 20, [tiers.PREMIUM]: 5 },
  [plans.BETA]: { total: 5, [tiers.PREMIUM]: 1 },
  [plans.PREMIUM_BETA]: { total: 20, [tiers.PREMIUM]: 5 },
  [plans.SUPER]: { total: 999, [tiers.PREMIUM]: 99  },
};

// TODO a lot of this is now very redundant - I think a major refactor of how tiers work is in order soon
const planTiers: Record<plans, Tier> = {
  [plans.FREE]: tiers.FREE,
  [plans.PREMIUM]: tiers.PREMIUM,
  [plans.BETA]: tiers.PREMIUM,
  [plans.PREMIUM_BETA]: tiers.PREMIUM,
  [plans.SUPER]: tiers.PREMIUM,
};

export function planTier(plan: plans | null | undefined): Tier {
  return planTiers[plan ?? plans.FREE] ?? tiers.FREE;
}

type TierLimit = {
  images: number, // image upload limit in bytes
};
export const tierLimits: Record<Tier, TierLimit> = {
  [tiers.FREE]: { images: 25_000_000 },
  [tiers.PREMIUM]: { images: 5_000_000_000 },
};

export class RollbackError extends Error {}

export async function withTransaction(callback: (conn: Trx) => Promise<void>) {
  const transaction = await kysely.startTransaction().execute();
  try {
    await callback(transaction);
    await transaction.commit().execute();
  } catch (err) {
    await transaction.rollback().execute();
    logger.warn('Transaction rolled back.');
    if (!(err instanceof RollbackError)) {
      throw err;
    }
  }
}

export const parseData = (conditions: { [key: string]: any } | undefined | null) => {
  if (!conditions) return { strings: [], values: [] };
  const keys = Object.keys(conditions).filter(key => conditions[key] !== undefined);
  const values = keys.map(key => conditions[key]);
  const strings = keys.map(key => `${key as string} = ?`);
  return { strings, values };
}

export type BaseOptions = {
  search?: string;
  sort?: string;
  forceSort?: boolean;
  sortDesc?: boolean;
  limit?: number,
  groupBy?: string[],
  where?: Cond,
  select?: [string, string?, (string | string[])?][],
  join?: ['INNER' | 'LEFT' | 'RIGHT', string | [string, string], Cond?][]
};

export class Cond {
  check?: string;
  value?: any;
  constructor(check?: string, value?: any) {
    this.check = check;
    this.value = value;
  }

  or(cond?: string | Cond, value?) {
    if (!(cond instanceof Cond)) return this.or(new Cond(cond, value));
    if (cond && !(cond.check || cond instanceof MultiCond)) return this;
    if (this && !(this.check || this instanceof MultiCond)) return cond;
    return new MultiCond('OR', this, cond);
  }

  and(cond?: string | Cond, value?) {
    if (!(cond instanceof Cond)) return this.and(new Cond(cond, value));
    if (cond && !(cond.check || cond instanceof MultiCond)) return this;
    if (this && !(this.check || this instanceof MultiCond)) return cond;
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

export function getPfpUrl(user: CommenterUserRaw) {
  return user.hasPfp ? `/api/users/${user.username}/pfp` : `https://www.gravatar.com/avatar/${md5(user.email ?? '')}.jpg`;
}

export function withPfp(users: CommenterUserRaw[]): CommenterUser[] {
  const result: CommenterUser[] = [];
  for (const user of users) {
    result.push({
      id: user.id,
      username: user.username,
      plan: user.plan,
      pfpUrl: getPfpUrl(user),
    });
  }
  return result;
}

type CacheableImage = { mimetype: string, name: string, data?: Buffer };

export function sendCachedImage(req: Request, res: Response, image: CacheableImage | undefined, cacheKey: string | number, immutable: boolean): Buffer | undefined {
  if (!image) return undefined;
  res.contentType(image.mimetype);
  if (req.query.download === '1') res.setHeader('Content-Disposition', `attachment; filename="${image.name}"`);
  res.setHeader('ETag', `"img-${cacheKey}"`);
  res.setHeader('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
  if (req.fresh) {
    res.status(304).end();
    return undefined;
  }
  return image.data;
}

export function handleAsNull(type: typeof RequestError | (typeof RequestError)[]) {
  if (type instanceof Array) {
    return (error: any): null => {
      if (type.some(t => error instanceof t)) {
        return null;
      }
      throw error;
    };
  } else {
    return (error: any): null => {
      if (error instanceof type) {
        return null;
      }
      throw error;
    };
  }
}

export function handleErrorWithData(error: any): null {
  if (error.data) {
    return error.data;
  }
  throw error;
}
