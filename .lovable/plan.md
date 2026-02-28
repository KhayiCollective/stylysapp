

## Problem

Shopify removed the compliance webhook UI from the Partner Dashboard. They now require compliance webhooks to be declared in a `shopify.app.toml` file and deployed via Shopify CLI (`shopify app deploy`). Your automated checks are failing because the compliance webhooks aren't declared in the app configuration.

## Solution: One-time Shopify CLI deploy

This is a **manual step outside Lovable** — you need to run the Shopify CLI once on your local machine.

### Step 1: Install Shopify CLI (if not installed)

```text
npm install -g @shopify/cli @shopify/app
```

### Step 2: Create a minimal project folder

Create a folder anywhere on your machine with one file:

**`shopify.app.toml`**
```toml
name = "STYLYS"
client_id = "<your SHOPIFY_CLIENT_ID from Partner Dashboard>"
application_url = "https://stylysapp.lovable.app"

[access_scopes]
scopes = "read_products,read_product_listings,write_checkouts"

[auth]
redirect_urls = [
  "https://mggxvtfgakplzzpcclte.supabase.co/functions/v1/shopify-oauth"
]

[webhooks]
api_version = "2025-07"

  [[webhooks.subscriptions]]
  topics = ["products/create", "products/update", "products/delete"]
  uri = "https://mggxvtfgakplzzpcclte.supabase.co/functions/v1/shopify-webhooks"

  [[webhooks.subscriptions]]
  topics = ["inventory_levels/update"]
  uri = "https://mggxvtfgakplzzpcclte.supabase.co/functions/v1/shopify-webhooks"

  [[webhooks.subscriptions]]
  topics = ["app/uninstalled"]
  uri = "https://mggxvtfgakplzzpcclte.supabase.co/functions/v1/shopify-webhooks"

  [[webhooks.subscriptions]]
  compliance_topics = ["customers/data_request"]
  uri = "https://mggxvtfgakplzzpcclte.supabase.co/functions/v1/shopify-webhooks"

  [[webhooks.subscriptions]]
  compliance_topics = ["customers/redact"]
  uri = "https://mggxvtfgakplzzpcclte.supabase.co/functions/v1/shopify-webhooks"

  [[webhooks.subscriptions]]
  compliance_topics = ["shop/redact"]
  uri = "https://mggxvtfgakplzzpcclte.supabase.co/functions/v1/shopify-webhooks"
```

### Step 3: Deploy once

```text
cd <your-folder>
shopify app deploy
```

This registers the compliance webhooks with Shopify's configuration system. You only need to do this once — the webhooks will persist. Your existing edge function already handles all these topics with HMAC verification.

### Why this can't be done from Lovable

The `shopify app deploy` command authenticates with Shopify's Partner API directly and updates the app's configuration metadata. This is separate from the webhook REST API registration and is specifically what the automated checker validates.

### No code changes needed

Your `shopify-webhooks` edge function already correctly handles all 3 compliance topics and verifies HMAC signatures. The only missing piece is the TOML-based declaration.

