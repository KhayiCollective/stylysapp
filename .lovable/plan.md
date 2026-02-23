
# Fix: Widget Not Using Selected Product + Same Outfits Every Time

## Problems Found

1. **Anchor product not working**: When you click "Style Me" on a product, the product's Shopify ID (e.g. `gid://shopify/Product/9076521566420`) is sent to the backend, but the backend searches by its own internal UUID. They never match, so the anchor is silently ignored.

2. **Same outfits every time**: The AI call doesn't include any randomness, so the model returns identical results on every request.

## Solution

### 1. Fix anchor product matching (Edge Function)
**File: `supabase/functions/widget-outfits/index.ts`**

Update the generate endpoint to match anchor products by `shopify_product_id` (the numeric Shopify ID) when the incoming ID looks like a Shopify GID, in addition to the existing UUID match:

```text
Before:  const anchorProduct = anchor_product_id ? products.find(p => p.id === anchor_product_id) : null;

After:   Match by UUID first, then by shopify_product_id extracted from the GID
```

Also add `shopify_product_id` to the SELECT query so it's available for matching.

### 2. Add variation to AI responses (Edge Function)
**File: `supabase/functions/widget-outfits/index.ts`**

- Set `temperature: 1.2` in the AI request body for more creative/varied output
- Add a random seed phrase to the user prompt (e.g. `"Variation seed: [random UUID]"`) to break caching and force distinct results each time

### 3. Pass Shopify product ID from the storefront (Frontend)
**File: `src/components/shop/ProductCard.tsx`**

The `node.id` from Shopify Storefront API is a GID like `gid://shopify/Product/9076521566420`. This is fine to pass -- the edge function will extract the numeric part and match against `shopify_product_id` in the products table.

No change needed here; the fix is entirely backend-side.

### 4. Same fix for ProductDetail page
**File: `src/pages/ProductDetail.tsx`**

Same situation -- the product `id` from Storefront API is already a Shopify GID. No frontend changes needed.

## Summary of Changes

| File | Change |
|------|--------|
| `supabase/functions/widget-outfits/index.ts` | Add `shopify_product_id` to SELECT; match anchor by Shopify GID; add `temperature: 1.2` and random seed to AI prompt |

Only one file needs to change. The fix is entirely in the edge function.
