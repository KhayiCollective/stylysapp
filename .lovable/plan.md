

## Problem

The current Shopify sync creates **one database row per variant** (every color + size combination). For example, "Ames Packable Straw Cowboy Hat" has 8 rows (2 colors × 4 sizes). This clutters the catalog and confuses the widget's outfit generation, which treats each size as a separate product.

The goal: **one product card per color**, with all size variants stored inside that card.

## Current Data Example

| name | shopify_product_id | shopify_variant_id |
|------|------|------|
| Ames Hat - Natural / XS 55 | 9341417455860 | 47688342175988 |
| Ames Hat - Natural / S/M 57 | 9341417455860 | 47688342208756 |
| Ames Hat - Natural / M/L 59 | 9341417455860 | 47688342241524 |
| Ames Hat - Chocolate / XS 55 | 9341417455860 | 47688342307060 |
| Ames Hat - Chocolate / S/M 57 | 9341417455860 | 47688342339828 |

**After fix:** 2 rows instead of 8 — one for "Natural", one for "Chocolate" — each with a `variants_json` column holding all sizes.

## Plan

### A. Add `variants_json` column to products table
**Migration:** Add a nullable `jsonb` column `variants_json` to store size variants per product-color row.

```sql
ALTER TABLE products ADD COLUMN variants_json jsonb DEFAULT '[]'::jsonb;
```

The structure will be:
```json
[
  { "variant_id": "47688342175988", "size": "XS 55", "price": "138.00", "available": true },
  { "variant_id": "47688342208756", "size": "S/M 57", "price": "138.00", "available": true }
]
```

### B. Update Shopify sync to group by product + color
**File:** `supabase/functions/shopify-product-sync/index.ts`

Currently the sync iterates `for (const variant of product.variants)` and inserts one row each. Change to:

1. Fetch full product data from Shopify Admin API including `options` (to identify which option is Color vs Size)
2. Group variants by their color option value (or by product if no color option exists)
3. For each color group, insert/upsert **one** product row with:
   - `name`: "Product Title - Color" (or just "Product Title" if single-color)
   - `color`: extracted from variant option
   - `shopify_variant_id`: first variant ID (for backward compat)
   - `variants_json`: array of all size variants with their IDs, sizes, and prices
   - `image_url`: color-specific image if available from Shopify, otherwise first image

The Shopify Admin API already returns `options` on each product (e.g., `[{name: "Color", values: ["Natural","Chocolate"]}, {name: "Size", values: ["XS","S/M"]}]`) and each variant has `option1`, `option2`, `option3` — so we can identify the color vs size axis.

### C. Update WooCommerce sync similarly
**File:** `supabase/functions/woocommerce-product-sync/index.ts`

Apply the same grouping logic for WooCommerce products that have color/size attributes.

### D. Update catalog display to show variants
**File:** `src/pages/Catalog.tsx`

- Update the `Product` interface to include `variants_json`
- Show a size count badge on each card (e.g., "4 sizes")
- The card still shows one image, one price, one color — just as requested

### E. Clean up existing duplicate rows
After the sync logic is updated, re-running sync will consolidate existing per-variant rows into per-color rows. Old per-variant rows with matching `shopify_product_id` that are no longer needed will be cleaned up by the sync process (mark for deletion any rows whose `shopify_variant_id` doesn't match the new "primary" variant for that color group).

### Files Modified
- **Migration**: Add `variants_json` column to `products` table
- `supabase/functions/shopify-product-sync/index.ts` — group variants by color, store sizes in `variants_json`
- `supabase/functions/woocommerce-product-sync/index.ts` — same grouping logic
- `src/pages/Catalog.tsx` — show variant count on product cards

