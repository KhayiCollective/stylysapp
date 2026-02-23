
# Make STYLYS Live Inside Shopify Admin (Embedded OAuth Flow)

## Problem
Currently, when a merchant opens STYLYS from the Shopify Admin sidebar, the "Connect Store" button opens a **new browser tab** for the OAuth flow. After connecting, the merchant is redirected to the standalone dashboard instead of returning to the embedded app inside Shopify Admin.

## Solution
Redirect the **entire Shopify Admin page** (top-level window) through the OAuth flow, and after successful connection, redirect back into the Shopify Admin embedded app -- so the merchant never leaves Shopify.

## Changes

### 1. EmbeddedConnectionRequired - Redirect top-level window instead of opening new tab
**File:** `src/components/embedded/EmbeddedConnectionRequired.tsx`

Instead of `window.open(connectUrl, '_blank')`, initiate the OAuth flow by redirecting the top-level window directly to the Shopify OAuth authorize URL via the edge function. This way:
- The merchant stays in a single browser flow
- After Shopify grants permission, the callback redirects them back to the embedded app

The "Connect Store" button will:
1. Call the `shopify-oauth?action=authorize` edge function with the shop domain
2. Set `window.top.location.href` to the returned Shopify OAuth URL (escaping the iframe)
3. Include `embedded=true` in the OAuth state so the callback knows to redirect back to the embedded context

### 2. ShopifyConnect callback - Redirect back to Shopify Admin
**File:** `src/pages/ShopifyConnect.tsx`

After a successful OAuth callback with `embedded=true` in the state:
- Instead of navigating to `/embedded?shop=...` (which won't work outside the iframe), redirect to the Shopify Admin app URL: `https://{shop}/admin/apps/stylys`
- This reopens STYLYS inside Shopify Admin where it will now pass verification

### 3. EmbeddedApp - Auto-initiate OAuth for unconnected stores
**File:** `src/pages/EmbeddedApp.tsx`

When `needsConnection` is detected and a `shop` param is present:
- Instead of showing the static "Connection Required" screen, automatically redirect to the OAuth flow (top-level) so the merchant doesn't need an extra click
- Keep the manual UI as a fallback

### 4. shopify-oauth edge function - Accept brand auto-creation for embedded flow
**File:** `supabase/functions/shopify-oauth/index.ts`

Add a new `action=embedded-authorize` endpoint that:
- Takes `shop` domain and `host` param
- Looks up or creates a brand record for the shop
- Returns the OAuth authorize URL with the correct state (brand_id + embedded flag)
- This eliminates the need for the merchant to sign in to STYLYS separately before connecting

---

## Technical Details

### OAuth flow (current vs. new)

**Current flow:**
```text
Shopify Admin -> /embedded -> "Connection Required" screen
  -> Opens new tab to /connect-shopify
  -> Merchant signs in, enters store URL, clicks Connect
  -> New tab redirects to Shopify OAuth -> callback to /connect-shopify
  -> Redirects to /dashboard (standalone)
```

**New flow:**
```text
Shopify Admin -> /embedded -> Detects unconnected store
  -> Redirects top-level window to Shopify OAuth (via edge function)
  -> Shopify OAuth callback -> /connect-shopify processes tokens
  -> Redirects to https://{shop}/admin/apps/stylys
  -> STYLYS loads embedded, store is now verified
```

### Key implementation details
- Use `window.top.location.href` to break out of the Shopify Admin iframe for OAuth
- The Shopify Partner app's redirect URI (`https://stylysapp.lovable.app/connect-shopify`) stays the same
- The OAuth state payload gets an `embedded: true` flag and the `shop` domain so the callback knows where to redirect
- The `EmbeddedConnectionRequired` component gets a direct OAuth initiation flow (calls the edge function, then redirects) rather than linking to the standalone connect page
- A new `embedded-authorize` action on the edge function handles brand lookup/creation without requiring Supabase auth, since the merchant may not have a STYLYS account yet
