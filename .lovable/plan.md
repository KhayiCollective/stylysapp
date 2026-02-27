

## Plan: Add "Register Missing Webhooks" Button

Rather than going through a full OAuth reconnect, we can add a `register-webhooks` action to `shopify-product-sync` that registers any missing webhooks using the existing access token stored in the database.

### Changes

1. **`supabase/functions/shopify-product-sync/index.ts`** — Add a new `action === "register-webhooks"` handler:
   - Fetch currently registered webhooks from Shopify
   - Compare against the expected list of 8 topics
   - Register any missing ones using the existing access token
   - Return a summary of what was registered

2. **`src/components/catalog/WebhookStatusIndicator.tsx`** — Add a "Register Missing Webhooks" button (visible when `!allRegistered`):
   - Calls `shopify-product-sync` with `action: 'register-webhooks'`
   - Shows success/failure toast
   - Auto-refreshes webhook status after registration

This avoids a full OAuth reconnect and uses the access token already stored in the `brands` table.

