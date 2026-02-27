

## Problem

Shopify requires three **mandatory compliance webhooks** for App Store listing:

1. **`customers/data_request`** — Respond when a customer requests their stored data
2. **`customers/redact`** — Delete customer data when requested
3. **`shop/redact`** — Erase all shop data 48 hours after app uninstall

Currently, the `shopify-webhooks` function handles product/inventory topics but lacks these three. Additionally, HMAC verification is currently **optional** (skipped when secret or header is missing) — it must be **mandatory** per Shopify requirements: return `401 Unauthorized` if the HMAC is invalid or missing.

## Changes

### 1. `supabase/functions/shopify-webhooks/index.ts`

**HMAC enforcement (strict):**
- Remove the conditional `if (SHOPIFY_CLIENT_SECRET && hmac)` guard
- Always require a valid `x-shopify-hmac-sha256` header
- Return `401` if HMAC header is missing or signature fails
- Use timing-safe comparison instead of `===` to prevent timing attacks

**Add three compliance topic handlers:**

- **`customers/data_request`**: Query the `customers` table for the given `customer.email` + shop's brand, return acknowledgment (the actual data export is handled offline)
- **`customers/redact`**: Delete matching rows from `customers` table (and any related `customer_outfits`, `wishlist_items`) for the brand + customer email
- **`shop/redact`**: Delete all `products`, `customers`, `outfits`, `rules`, `widget_config`, and clear brand tokens for the given shop domain — full data erasure

### 2. `supabase/functions/shopify-oauth/index.ts`

- Add the three compliance webhook topics to the `WEBHOOK_TOPICS` array so they are auto-registered during OAuth callback

### 3. `src/components/catalog/WebhookStatusIndicator.tsx`

- Add the three compliance topics to the `expectedWebhooks` list so the UI shows their registration status

