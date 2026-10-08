import md5 from 'md5';
import { SqlBool } from 'kysely';

export function deepCompare(a: unknown, b: unknown): boolean {
  if (!(a instanceof Object && b instanceof Object)) {
    return a === b;
  }
  for (const key in a) {
    if (!(key in b)) return false;
    if (!deepCompare(a[key], b[key])) return false;
  }
  for (const key in b) {
    if (!(key in a)) return false;
  }
  return true;
}

export function getPfpUrl(user: { hasPfp: SqlBool, username: string, email: string }) {
  return user.hasPfp ? `/api/users/${user.username}/pfp` : `https://www.gravatar.com/avatar/${md5(user.email ?? '')}.jpg`;
}
