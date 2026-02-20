
# Fix Shopify OAuth Redirect URI

## Problem
The Shopify OAuth flow uses `window.location.origin` to construct the redirect URI dynamically. If the browser is on a domain not exactly matching one of the three whitelisted URLs in the Shopify Partner dashboard, the flow fails with "redirect_uri is not whitelisted."

## Solution
Hardcode the redirect URI to always use the published domain `https://stylysapp.lovable.app/connect-shopify`. This domain is stable and already whitelisted.

## Changes

### 1. `src/pages/ShopifyConnect.tsx`
- **Line 39**: Change the top-level `redirectUri` from `window.location.origin` to the published domain:
  ```typescript
  const redirectUri = `https://stylysapp.lovable.app/connect-shopify`;
  ```
- **Line 293**: Same change for the `redirectUri` inside `handleConnect`:
  ```typescript
  const redirectUri = `https://stylysapp.lovable.app/connect-shopify`;
  ```

This ensures Shopify always receives a redirect URI that matches the whitelisted URL, regardless of which preview/dev domain you are browsing from.

### Technical Detail
After Shopify redirects back to `stylysapp.lovable.app/connect-shopify`, the existing callback handling code will process the `code`, `shop`, and `state` query parameters and complete the token exchange. No other changes are needed.
