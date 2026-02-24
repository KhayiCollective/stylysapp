

## Fix: Post-OAuth Redirect 404 in Shopify Admin

### Problem
After the OAuth flow completes successfully, `ShopifyConnect.tsx` redirects to:
```
https://{shop}.myshopify.com/admin/apps/stylys
```
But Shopify's internal app handle may not be `stylys` -- it could be `stylys-1`, `stylys-ai`, or another auto-generated slug. This causes the Shopify Admin 404 page you're seeing.

### Solution
Replace the hardcoded `stylys` handle with the Shopify **Client ID** (`e1bde8232afcab4c37b12a9b29c3dde1`), which always works as an app identifier in the admin URL:
```
https://{shop}.myshopify.com/admin/apps/e1bde8232afcab4c37b12a9b29c3dde1
```

### Files to Change

**1. `src/pages/ShopifyConnect.tsx` (line 165)**
Change:
```js
window.location.href = `https://${shopName}.myshopify.com/admin/apps/stylys`;
```
To:
```js
window.location.href = `https://${shopName}.myshopify.com/admin/apps/e1bde8232afcab4c37b12a9b29c3dde1`;
```

Also update lines 219-220 (the "already connected" redirect) with the same fix.

**2. `src/components/embedded/EmbeddedConnectionRequired.tsx`**
No changes needed -- this component redirects to the OAuth URL, not back to the admin app page.

### After Deploying
- Click **Publish > Update** to deploy the frontend change
- Re-open STYLYS from your Shopify Admin sidebar to test the full flow

