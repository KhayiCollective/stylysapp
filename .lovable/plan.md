
# Update All URLs to Custom Domain `stylysapp.com`

## Overview
Replace every hardcoded `stylysapp.lovable.app` reference with `stylysapp.com` so the Shopify embedded app, OAuth flow, and widget all use your new custom domain.

## Files to Change

### 1. `src/pages/ShopifyConnect.tsx`
- **Line 39**: Change redirect URI from `stylysapp.lovable.app` to `stylysapp.com`
- **Line 297**: Same change for the second redirect URI reference

### 2. `supabase/functions/shopify-oauth/index.ts`
- **Line 135**: Change embedded-authorize redirect URI from `stylysapp.lovable.app` to `stylysapp.com`

### 3. `supabase/functions/widget-loader/index.ts`
- **Line 17**: Simplify widget preview URL to use `stylysapp.com` directly
- **Line 20**: Change `appUrl` to `https://stylysapp.com`
- **Line 40**: Change widget icon image URL to `stylysapp.com`

## After Code Changes -- You Need To Do

1. **Publish** the app so frontend changes go live on the custom domain
2. **Update your Shopify Partner Dashboard**:
   - **App URL**: `https://stylysapp.com/embedded`
   - **Allowed redirection URL(s)**: `https://stylysapp.com/connect-shopify`
3. Open the app from your Shopify Admin sidebar to test
