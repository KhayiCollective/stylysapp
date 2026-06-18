## Plan: Fix Shopify OAuth Redirect URI Whitelisting

### Problem
The Shopify OAuth flow fails with 'redirect_uri is not whitelisted' because `shopify.app.toml` is missing the custom domain redirect URL.

### Solution
Add `https://stylysapp.com/connect-shopify` to the `[auth].redirect_urls` array in `shopify.app.toml`.

### Changes
File: `shopify.app.toml`
- Current: only `https://stylysapp.lovable.app/connect-shopify` is registered
- Update: add `https://stylysapp.com/connect-shopify` to the `redirect_urls` array

### Post-fix
After merging, the user should run `shopify app deploy` (or equivalent) to push the updated app configuration to Shopify's servers so the new redirect URI is whitelisted.