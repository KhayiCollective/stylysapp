export const TIERS = {
  starter: {
    priceId: "price_1T2ImWAPHLOcQhD5RQzncSxz",
    productId: "prod_U0JP7bqkK76rlC",
    name: "Starter",
    price: "$14.99",
    maxProducts: 500,
    features: ["ai_outfits", "virtual_tryon", "basic_analytics"] as const,
  },
  professional: {
    priceId: "price_1T2IvoAPHLOcQhD5wvLGulKF",
    productId: "prod_U0JYdx4Jx81TPX",
    name: "Professional",
    price: "$29.99",
    maxProducts: 1000,
    features: [
      "ai_outfits",
      "virtual_tryon",
      "styling_chatbot",
      "priority_support",
      "full_analytics",
      "customer_tracking",
    ] as const,
  },
} as const;

export type TierKey = keyof typeof TIERS;
export type Feature = (typeof TIERS)[TierKey]["features"][number];

export function getTierByProductId(productId: string): TierKey | null {
  for (const [key, tier] of Object.entries(TIERS)) {
    if (tier.productId === productId) return key as TierKey;
  }
  return null;
}

export function getTierLimits(tierName: TierKey | null) {
  if (!tierName) return { maxProducts: 0, features: [] as readonly string[] };
  return {
    maxProducts: TIERS[tierName].maxProducts,
    features: TIERS[tierName].features,
  };
}

export function hasFeature(tierName: TierKey | null, feature: string): boolean {
  if (!tierName) return false;
  return (TIERS[tierName].features as readonly string[]).includes(feature);
}
