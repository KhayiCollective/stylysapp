

## Diagnosis: Why Shopify's Automated Checks Are Failing

The screenshot shows two failing checks:
- **Provides mandatory compliance webhooks** — ✗
- **Verifies webhooks with HMAC signatures** — ✗

### Root Cause

The `shopify.app.toml` file has the correct webhook configuration, and the edge function correctly verifies HMAC and handles all three compliance topics. However, **two things need to happen**:

1. **Replace the placeholder `client_id`** in `shopify.app.toml` (line 5: `client_id = "YOUR_CLIENT_ID_HERE"`) with your actual Shopify app Client ID from the Shopify Partner Dashboard.

2. **Run `shopify app deploy`** locally to register the webhook subscriptions with Shopify. Until this is done, Shopify doesn't know about your compliance webhook endpoints.

### What's Already Working (No Code Changes Needed)

- The edge function at `shopify-webhooks` already handles `customers/data_request`, `customers/redact`, and `shop/redact`
- HMAC verification is implemented and confirmed working (returns 401 for invalid signatures)
- The `SHOPIFY_CLIENT_SECRET` secret is configured
- The `shopify.app.toml` webhook subscriptions are correctly structured

### Steps to Fix

1. **Update `shopify.app.toml`** — Replace `YOUR_CLIENT_ID_HERE` with your actual Shopify app Client ID (found in Shopify Partner Dashboard → Apps → your app → Client credentials)

2. **Deploy locally** — Pull the latest code and run:
   ```
   shopify app deploy
   ```
   Confirm the webhook changes when prompted.

3. **Re-run the automated checks** in the Shopify Partner Dashboard.

### One Code Change

Update line 5 of `shopify.app.toml` with the real client ID. If you provide your Client ID, I can make that change immediately.

