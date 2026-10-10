export const paidTiers = {
  PREMIUM: 1,
} as const;
type ValueOf<T> = T[keyof T];
export type PaidTier = ValueOf<typeof paidTiers>;

export const tiers = {
  FREE: 0,
  ...paidTiers,
} as const;
export type Tier = ValueOf<typeof tiers>;
