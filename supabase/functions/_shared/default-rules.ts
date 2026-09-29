// Canonical default rule set for a brand new to STYLYS. Every place that
// creates a `brands` row (standalone signup via account-bootstrap, Shopify
// embedded install via shopify-oauth, and the self-healing check in
// ensure-default-rules) should seed exactly this set so the Rules page always
// has something to render for Styling / Inventory / Pricing / Outfit
// Composition, regardless of which path the merchant came in through.
//
// Previously only account-bootstrap seeded rules, and only 3 of these 7 (no
// pricing-category rule, no composition rule at all) — the Shopify OAuth
// embedded-install path (the one real merchants actually use from the App
// Store) never seeded rules at all, leaving Styling/Inventory/Pricing empty
// and Outfit Composition entirely missing on the Rules page.

export interface DefaultRuleInput {
  brand_id: string;
  name: string;
  category: "styling" | "inventory" | "pricing" | "composition";
  description: string;
  enabled: boolean;
  config?: Record<string, unknown>;
}

export const DEFAULT_COMPOSITION_CONFIG = {
  minItems: 3,
  maxItems: 5,
  requiredCategories: ["tops", "bottoms"],
  optionalCategories: ["shoes", "bags", "accessories", "hats", "sunglasses", "jewelry"],
};

export function buildDefaultRules(brandId: string): DefaultRuleInput[] {
  return [
    // Styling
    {
      brand_id: brandId,
      name: "Color Harmony",
      category: "styling",
      description: "Limit outfits to a maximum of 3 dominant colors for a cohesive look.",
      enabled: true,
    },
    {
      brand_id: brandId,
      name: "Fit Balance",
      category: "styling",
      description: "Pair fitted pieces with relaxed pieces rather than all-tight or all-loose outfits.",
      enabled: true,
    },
    {
      brand_id: brandId,
      name: "Category Balance",
      category: "styling",
      description: "Ensure outfits mix complementary categories instead of repeating the same type of item.",
      enabled: true,
    },
    {
      brand_id: brandId,
      name: "Seasonal Relevance",
      category: "styling",
      description: "Favor products suited to the current season when building outfits.",
      enabled: false,
    },
    // Inventory
    {
      brand_id: brandId,
      name: "In-Stock Only",
      category: "inventory",
      description: "Only include products that are currently in stock.",
      enabled: true,
    },
    // Pricing
    {
      brand_id: brandId,
      name: "Price Range Match",
      category: "pricing",
      description: "Keep outfit items within the customer's selected budget range where possible.",
      enabled: true,
    },
    // Composition
    {
      brand_id: brandId,
      name: "Outfit Composition",
      category: "composition",
      description: "Controls how many items an outfit has and which categories are required vs. optional.",
      enabled: true,
      config: DEFAULT_COMPOSITION_CONFIG,
    },
  ];
}
