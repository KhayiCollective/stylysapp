

## Problem

The three compliance webhooks (`customers/data_request`, `customers/redact`, `shop/redact`) always show as "Missing" in the Webhook Status indicator. This happens because:

1. **Shopify compliance webhooks cannot be registered or queried via the REST Admin API** (`webhooks.json`). They are managed exclusively through `shopify.app.toml` + `shopify app deploy`.
2. The `fetchWebhooks` function calls the REST API, which only returns the 5 standard webhooks — never the compliance ones.
3. The "Register Missing Webhooks" button also uses the REST API, so it will always fail silently for these 3 topics.

**Result**: The UI will permanently show these as "Missing" regardless of actual deployment status.

## Plan

### 1. Update `WebhookStatusIndicator` component

Split the expected webhooks into two groups:
- **API-managed** (5): `products/create`, `products/update`, `products/delete`, `inventory_levels/update`, `app/uninstalled` — these can be listed and registered via REST API
- **App-config-managed** (3): `customers/data_request`, `customers/redact`, `shop/redact` — these are declared in `shopify.app.toml` and deployed via CLI

For the compliance webhooks, show them in a separate section with a distinct visual treatment (info icon instead of error icon) and a note explaining they are managed via app configuration and require `shopify app deploy` to register.

The "Register Missing Webhooks" button should only attempt to register the API-managed topics.

The overall badge should show "Active" when all 5 API-managed webhooks are registered, and the compliance section should indicate whether `shopify app deploy` has been run (or just display them as "Config-managed").

### 2. Update `shopify-product-sync` edge function

In the `register-webhooks` action (line 243), remove the 3 compliance topics from `EXPECTED_TOPICS` since they cannot be registered via REST API. This prevents false "failed" results.

### Files changed
- `src/components/catalog/WebhookStatusIndicator.tsx` — split webhook display into API vs config-managed sections
- `supabase/functions/shopify-product-sync/index.ts` — remove compliance topics from REST API registration list

