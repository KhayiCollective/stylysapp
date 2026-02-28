

## Plan: Add Compliance Webhooks Step to Shopify Setup Guide

### Problem
Shopify requires compliance webhooks (`customers/data_request`, `customers/redact`, `shop/redact`) to be declared in a `shopify.app.toml` file and deployed via Shopify CLI. The setup guide currently has 6 steps and doesn't cover this mandatory requirement. The edge function already handles these topics — only the TOML declaration is missing.

### Changes

**1. New file: `shopify.app.toml`** (project root)
A ready-to-use template with:
- `client_id` placeholder (`YOUR_CLIENT_ID_HERE`)
- `application_url` pointing to the published app URL
- Access scopes matching Step 4
- Redirect URL matching Step 3
- All webhook subscriptions (product events, inventory, app/uninstalled)
- Compliance topics declaration pointing to `https://mggxvtfgakplzzpcclte.supabase.co/functions/v1/shopify-webhooks`

**2. Modified: `src/pages/ShopifySetupGuide.tsx`**
Add **Step 7: "Register Compliance Webhooks"** between Step 6 and the Test section:
- Brief explanation: Shopify requires 3 mandatory compliance webhooks declared via `shopify.app.toml`
- Substep 1: Install Shopify CLI — copyable command: `npm install -g @shopify/cli @shopify/app`
- Substep 2: Create a folder with `shopify.app.toml` — display the full TOML content in a copyable code block, with a note to replace `YOUR_CLIENT_ID_HERE`
- Substep 3: Run `shopify app deploy` — copyable command
- Note: this is a one-time step; the backend function already handles these webhooks with HMAC verification
- Add `Terminal` icon import from lucide-react

### No backend changes needed
The `shopify-webhooks` edge function already implements all 3 compliance handlers with strict HMAC verification.

