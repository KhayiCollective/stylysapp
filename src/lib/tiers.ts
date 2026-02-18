export const TIERS = {
  starter: {
    priceId: "price_1T2ImWAPHLOcQhD5RQzncSxz",
    productId: "prod_U0JP7bqkK76rlC",
    name: "Starter",
    price: "$14.99",
  },
  professional: {
    priceId: "price_1T2IvoAPHLOcQhD5wvLGulKF",
    productId: "prod_U0JYdx4Jx81TPX",
    name: "Professional",
    price: "$29.99",
  },
} as const;

export type TierKey = keyof typeof TIERS;

export function getTierByProductId(productId: string): TierKey | null {
  for (const [key, tier] of Object.entries(TIERS)) {
    if (tier.productId === productId) return key as TierKey;
  }
  return null;
}
