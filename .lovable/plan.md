

## Add Billing Scope to Shopify OAuth Flow

### The Problem
Your `create-checkout` edge function uses Shopify's `appSubscriptionCreate` GraphQL mutation, which requires the `write_merchant_managed_pricing_and_billing` scope. This scope is currently missing from your OAuth scopes string in `shopify-oauth/index.ts`.

### The Fix
A single-line change in `supabase/functions/shopify-oauth/index.ts`:

**Current SCOPES (line 16):**
```
read_products,read_product_listings,unauthenticated_read_product_listings,
unauthenticated_read_product_tags,write_checkouts,unauthenticated_write_checkouts,
write_script_tags
```

**Updated SCOPES:**
```
read_products,read_product_listings,unauthenticated_read_product_listings,
unauthenticated_read_product_tags,write_checkouts,unauthenticated_write_checkouts,
write_script_tags,write_merchant_managed_pricing_and_billing
```

### Important: Re-installation Required
After deploying this change, merchants (including your dev store) will need to **re-install** the app for Shopify to prompt them to approve the new billing permission. You can do this by:

1. Go to your dev store admin
2. Uninstall the STYLYS app
3. Re-install it from the Partner Dashboard

This will trigger the OAuth flow with the new scope included.

### Technical Details
- File changed: `supabase/functions/shopify-oauth/index.ts` (line 16)
- The scope is not something you toggle in the Shopify Dev Dashboard -- it's requested programmatically during OAuth
- No dashboard configuration needed for this scope

