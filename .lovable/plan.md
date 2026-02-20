

# Fix: Cart Items Not Showing + Switch Billing to Shopify

## Issue 1: "Add All to Cart" Shows Toast but Items Don't Appear

**Root Cause**: The cart is being added to correctly (the Zustand store updates), but the current cart implementation is local-only — it doesn't sync with Shopify's Storefront API. The `CartDrawer` component is rendered in `ShopHeader` on the `/shop` page, but the "Add All" button lives inside the `CustomerWidget` (the STYLYS sidebar). Items ARE being stored in Zustand, but there are two problems:

1. The cart store uses simple local `addItem` (no Shopify cart creation), so when you click "Checkout", it tries to call `createStorefrontCheckout` which creates a brand new cart each time — and the outfit items use mock/local IDs (not real Shopify variant IDs like `gid://shopify/ProductVariant/123`), so the Shopify API rejects them.
2. The cart needs to be upgraded to the real-time Shopify cart sync pattern (create cart on first add, track line IDs).

**Fix**: Upgrade the cart store to use Shopify's Cart API (cartCreate, cartLinesAdd, cartLinesUpdate, cartLinesRemove) so items are synced in real-time with Shopify and checkout URLs are always available.

### Changes:
- **`src/lib/shopify.ts`** — Add cart management mutations (cartCreate, cartLinesAdd, cartLinesUpdate, cartLinesRemove) and helper functions
- **`src/stores/cartStore.ts`** — Rewrite to use real-time Shopify cart sync: create cart on first item, track lineIds, get checkoutUrl immediately
- **`src/components/shop/CartDrawer.tsx`** — Update to use new store shape (getCheckoutUrl instead of createCheckout, add syncCart on open)
- **`src/hooks/useCartSync.ts`** — New hook to sync cart on page load and tab visibility change (clears completed orders)
- **`src/App.tsx`** — Add useCartSync hook
- **`src/components/widget/tabs/OutfitsTab.tsx`** — Update handleAddAllToCart to use the new async addItem

**Important note**: The "Add All" from outfits uses generated outfit item IDs — these may not be real Shopify variant IDs. If the outfit items come from the AI outfit generator and don't have real Shopify variant GIDs, the Shopify cart API will reject them. We'll add validation to only add items with valid Shopify IDs and show an appropriate message for others.

---

## Issue 2: Switch Billing from Stripe to Shopify

**Current State**: Billing is managed through Stripe with three edge functions:
- `create-checkout` — Creates a Stripe Checkout session
- `check-subscription` — Checks Stripe subscription status
- `customer-portal` — Opens Stripe Customer Portal

Plus `src/lib/tiers.ts` with Stripe price/product IDs, and `src/hooks/useSubscription.ts`.

**What needs to change**: Replace Stripe billing with Shopify's App Subscription Billing API. This means:

- **`supabase/functions/create-checkout/index.ts`** — Replace Stripe checkout with Shopify's `appSubscriptionCreate` GraphQL mutation (uses the Shopify Admin API)
- **`supabase/functions/check-subscription/index.ts`** — Replace Stripe subscription check with querying Shopify's `currentAppInstallation` for active subscriptions
- **`supabase/functions/customer-portal/index.ts`** — Replace with redirect to Shopify's subscription management page
- **`src/lib/tiers.ts`** — Remove Stripe price/product IDs, add Shopify plan names
- **`src/hooks/useSubscription.ts`** — May need minor updates depending on response shape
- **`src/pages/Settings.tsx`** — Update billing section to use Shopify billing flow
- **`src/pages/Auth.tsx`** — Remove Stripe checkout redirect on plan param

### How Shopify App Billing Works:
1. Merchant installs the app -> app calls `appSubscriptionCreate` mutation via Shopify Admin API
2. Shopify returns a confirmation URL -> merchant approves the charge on Shopify
3. App checks subscription status via `currentAppInstallation` query
4. Shopify handles all payment processing, invoicing, and cancellation

This requires the `SHOPIFY_ACCESS_TOKEN` (already configured) and the merchant's Shopify store domain (already stored in the `brands` table).

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/lib/shopify.ts` | Add cart mutations and helper functions |
| `src/stores/cartStore.ts` | Rewrite with real-time Shopify cart sync |
| `src/components/shop/CartDrawer.tsx` | Update for new store API |
| `src/hooks/useCartSync.ts` | New — cart sync on visibility |
| `src/App.tsx` | Add useCartSync |
| `src/components/widget/tabs/OutfitsTab.tsx` | Update for async addItem |
| `supabase/functions/create-checkout/index.ts` | Replace Stripe with Shopify billing |
| `supabase/functions/check-subscription/index.ts` | Replace Stripe with Shopify billing |
| `supabase/functions/customer-portal/index.ts` | Replace with Shopify redirect |
| `src/lib/tiers.ts` | Remove Stripe IDs, add Shopify plan names |
| `src/pages/Settings.tsx` | Update billing UI for Shopify |
| `src/pages/Auth.tsx` | Remove Stripe checkout redirect |

