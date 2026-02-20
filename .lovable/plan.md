

## Plan: Reset Shopify Connection for Real Dev Store

### Problem
The database has a stale connection to `test-store.myshopify.com` (a placeholder). This causes the `/connect-shopify` page to skip the OAuth flow and redirect straight to the dashboard. The stored access tokens are from the placeholder and won't work with the real dev store.

### Solution
Clear the old Shopify connection fields on the brand record so the OAuth flow can run fresh.

### Steps

1. **Run a database migration** to clear the Shopify connection fields on the user's brand:
   - Set `shopify_store_domain`, `shopify_access_token`, `shopify_storefront_token`, and `shopify_connected_at` to `NULL` on brand `cbfe18b2-b2f2-444f-a6fc-bbf9439c37a7`

2. **Update the `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` secrets** with the real values the user provided earlier (if not already done)

3. **After reset**, the user navigates to `/connect-shopify`, enters their real dev store domain (e.g., `my-store.myshopify.com`), and completes the Shopify OAuth install flow which will save real access tokens

### Technical Details

**Database update (one-time data fix, not a schema migration):**
```sql
UPDATE brands
SET shopify_store_domain = NULL,
    shopify_access_token = NULL,
    shopify_storefront_token = NULL,
    shopify_connected_at = NULL
WHERE id = 'cbfe18b2-b2f2-444f-a6fc-bbf9439c37a7';
```

**Secrets to update:**
- `SHOPIFY_CLIENT_ID` -> `e1bde8232afcab4c37b12a9b29c3dde1`
- `SHOPIFY_CLIENT_SECRET` -> `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`

**No code changes needed** -- the existing OAuth flow in `ShopifyConnect.tsx` and `shopify-oauth` edge function will handle everything once the stale data is cleared.
