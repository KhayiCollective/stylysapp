

## Problem: "Failed to complete connection" — Unique Constraint Violation

### Root Cause

The `brands` table has a **unique constraint** on `shopify_store_domain` (`unique_shopify_store_domain`).

When you previously tested via the embedded flow, the `embedded-authorize` action auto-created a brand record (ID `7b3d7a56`) with `shopify_store_domain: khayi-collective.myshopify.com`.

Now, when you connect via the standalone flow, the OAuth callback tries to update **your actual brand** (ID `d8e44ff4`, "My Brand") with `shopify_store_domain: khayi-collective.myshopify.com` — but that domain is already claimed by the auto-created brand. This violates the unique constraint, so the database update fails.

### Fix (Two Parts)

#### 1. Clean up orphan brand record

Delete the auto-created brand `7b3d7a56` ("khayi-collective") that has no profile pointing to it — it's an orphan from the embedded-authorize flow.

```sql
DELETE FROM brands WHERE id = '7b3d7a56-46a8-4ba2-9c8f-45b0a4609974';
```

#### 2. Update the edge function to handle domain conflicts

In `supabase/functions/shopify-oauth/index.ts`, before the `brands` update in the callback handler, add a step that clears `shopify_store_domain` from any other brand that might hold the same domain. This prevents future collisions from embedded-authorize auto-created brands.

```typescript
// Before updating the target brand, clear the domain from any orphan brands
await supabase
  .from("brands")
  .update({ shopify_store_domain: null })
  .eq("shopify_store_domain", shop)
  .neq("id", brandId);
```

Also improve the error log to include the actual database error message so future issues are easier to diagnose:

```typescript
if (updateError) {
  console.error("[SHOPIFY-OAUTH] Database update failed:", updateError.message, updateError.code);
  // ...
}
```

### Files Modified
- **Database migration**: Delete orphan brand record
- **`supabase/functions/shopify-oauth/index.ts`**: Add domain conflict resolution before brand update, improve error logging

### After Fix
You should be able to retry connecting `khayi-collective.myshopify.com` and the OAuth callback will succeed.

