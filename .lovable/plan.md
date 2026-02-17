

# Fix: Widget Script Tag Permission Error

## The Problem
The widget toggle is failing because the Shopify access token stored for your connected store was obtained **before** `write_script_tags` was added to the OAuth scopes. Shopify requires the merchant to re-approve the app to grant the new permission.

## The Fix

### 1. Add a "Reconnect Store" action in Settings
Update the Shopify connection UI on the Settings page to include a "Re-authorize" button that triggers a new OAuth flow. When the merchant clicks it, they'll be redirected to Shopify to approve the updated scopes (including `write_script_tags`). On callback, the new token (with full permissions) replaces the old one.

### 2. Improve error handling in WidgetStatus
Update `WidgetStatus.tsx` to detect the "scope" error and show a clear message like: *"Your store needs to re-authorize to enable the widget. Click Re-authorize below."* instead of a generic failure toast.

### 3. No database or schema changes needed
The `widget_script_tag_id` column and all edge functions are already in place. Only the stored access token needs to be refreshed via re-authorization.

## Technical Details

- **`src/pages/Settings.tsx`** or **`src/components/ShopifyConnection.tsx`**: Add a "Re-authorize" button that triggers the existing OAuth `authorize` flow for the already-connected shop domain. This re-uses the same `shopify-oauth?action=authorize` endpoint.
- **`src/components/settings/WidgetStatus.tsx`**: Catch the specific scope error from `shopify-widget-toggle` and surface actionable guidance instead of a generic error toast.
- **`supabase/functions/shopify-widget-toggle/index.ts`**: Pass through the Shopify error detail so the frontend can distinguish scope errors from other failures.

## What the Merchant Experiences
1. Sees "Widget failed — your store needs updated permissions"
2. Clicks "Re-authorize"
3. Redirected to Shopify, clicks "Update app"
4. Redirected back, new token saved automatically
5. Widget toggle now works

