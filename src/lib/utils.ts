import md5 from 'md5';
import { SqlBool } from 'kysely';
import { CommenterUserRaw, CommenterUser } from '../api/models/discussion';

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
