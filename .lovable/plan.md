
# Auto-Install Widget on Shopify Store (Zero Merchant Effort)

## What Changes
Instead of requiring merchants to manually set up a Theme App Extension or paste code, the widget script will be **automatically injected** into their Shopify store the moment they connect via OAuth. Merchants don't need to touch any code or theme settings.

## How It Works
1. When the Shopify OAuth flow completes successfully (store connects), the system automatically registers a **Script Tag** via the Shopify Admin API
2. This script tag loads a small JavaScript file served by a backend function
3. That script renders the STYLYS sidebar widget (floating button + slide-out panel) on every page of the merchant's store
4. Merchants can see the widget status and toggle it on/off from their Settings page

## Technical Details

### 1. Update the Shopify OAuth callback (`supabase/functions/shopify-oauth/index.ts`)
- After saving the access token, make one additional API call to Shopify's Script Tag API:
  ```
  POST /admin/api/2025-01/script_tags.json
  { script_tag: { event: "onload", src: "<widget-js-url>?brand_id=<brand_id>" } }
  ```
- The OAuth scopes already include what's needed (`write_script_tags` will need to be added to the SCOPES constant)
- Save the script tag ID to the `brands` table so it can be managed later

### 2. Add a `widget_script_tag_id` column to the `brands` table
- Stores the Shopify Script Tag ID so we can update/remove it later
- Simple migration: `ALTER TABLE brands ADD COLUMN widget_script_tag_id text;`

### 3. Create a widget loader edge function (`supabase/functions/widget-loader/index.ts`)
- Serves a lightweight JavaScript file that:
  - Creates a floating button (sparkle icon) on the store page
  - When clicked, opens an iframe pointing to the STYLYS widget preview page
  - Reads `brand_id` from the script URL query parameter
- This is a static JS response, so it's fast and cacheable

### 4. Update the Settings page (`src/pages/Settings.tsx`)
- Add a "Widget Status" indicator in the Shopify Connection card showing whether the widget is live on the store
- Add a toggle or button to enable/disable the widget (creates or removes the script tag)

### 5. Update OAuth scopes
- Add `write_script_tags` to the SCOPES constant in `shopify-oauth` so the app has permission to inject scripts

## What Merchants Experience
- Connect their Shopify store (already works)
- Widget automatically appears on their storefront -- done
- They can see "Widget: Active" in their Settings page
- They can disable it with one click if needed
