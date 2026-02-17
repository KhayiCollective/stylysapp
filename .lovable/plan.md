

# Fix Customer Widget, Account Separation, and Virtual Try-On

## Summary
There are several issues that need fixing across the customer-facing widget and the merchant dashboard. The core problem is that features meant for customers (outfit generator, saved outfits, virtual try-on) are currently sitting in the merchant dashboard, and the widget itself has UI/data issues.

## Issues and Fixes

### 1. Widget floating button still shows sparkle icon (on live Shopify store)
**Problem**: The screenshots show the widget-loader button on the Shopify store (stylys-2.myshopify.com) still displays a sparkle icon instead of the new STYLYS "S" logo.
**Root cause**: The widget-loader edge function was updated but the app hasn't been published yet, so `https://stylysapp.lovable.app/favicon.png` still serves the old file. Additionally, Shopify and browsers may be caching the old script.
**Fix**: Publish the app. Also add a cache-busting query parameter to the favicon URL in the widget-loader to force refresh: `favicon.png?v=2`.

### 2. Widget sidebar header says "AI Stylist" with sparkle icon
**Problem**: First screenshot shows the widget panel header says "AI Stylist" with a sparkle icon instead of the STYLYS branding.
**Root cause**: The `widget-loader/index.ts` panel does not include a header -- this is coming from the iframe loading `widget-preview`. The `WidgetPreview` page loads `CustomerWidget`, which already has the correct STYLYS header. The screenshots suggest the live published version hasn't been updated yet.
**Fix**: This resolves with publishing. No code change needed for the sidebar header -- it's already correct in `CustomerWidget.tsx`.

### 3. Widget not showing products from merchant's catalog
**Problem**: The Outfits tab in the widget calls `widget-outfits/generate` with a `brand_id`, but the `WidgetPreview` page passes no `brandId` to `CustomerWidget`, so the widget has no brand context.
**Fix**:
- Update `WidgetPreview` to read `brand_id` from the URL query parameter and pass it to `CustomerWidget`.
- Update `widget-loader/index.ts` to pass `brand_id` into the iframe URL (already done).
- The outfits generation already queries real products from the `products` table by `brand_id`.

### 4. Customer login shows as "Merchant Account Login"
**Problem**: The first screenshot shows "Connect Shopify" in the widget -- this appears to be the widget showing Shopify connection instead of customer login. The widget Account tab actually has correct customer auth (sign in / create account), not merchant auth.
**Root cause**: Looking at the screenshot more carefully, the "Connect Shopify" panel is from the `ShopLayout > StylingChatbot` component on the `/shop` page, not from the CustomerWidget. The customer widget Account tab correctly shows "Welcome Back" / "Create Account" for customer auth.
**Fix**: No change needed for the widget's Account tab -- it already uses the separate customer JWT auth system. The "Connect Shopify" visible in the screenshot is from the Shop page's chatbot, not the customer widget.

### 5. Outfit Generator and Saved Outfits belong in customer account, not merchant dashboard
**Problem**: The Outfit Generator (`/generator`) and Saved Outfits (`/wishlist`) are in the merchant dashboard sidebar. These should be customer-facing features within the widget, not merchant tools.
**Fix**:
- Remove "Outfit Generator" and "Saved Outfits" from the merchant dashboard sidebar navigation.
- The widget already has an Outfits tab that generates outfits from the catalog -- this is the correct customer-facing location.
- The widget's saved outfits are already handled via `widget-outfits/save` and the Account tab shows a "Saved Outfits" link.
- Keep the `/generator` route accessible for dev/testing but remove it from the main nav.

### 6. Virtual Try-On portrait layout
**Problem**: The user image and result image in TryOnTab use `h-40` and `h-48` heights with `object-cover`, cropping to landscape. For full-body try-on, images should display in portrait aspect ratio.
**Fix**:
- In `TryOnTab.tsx`: Change user image from `h-40` to `aspect-[3/4]` for portrait layout.
- Change result image from `h-48` to `aspect-[3/4]` for portrait layout.
- In `VirtualTryOn.tsx` (merchant dashboard version): Change user image from `h-48` to `aspect-[3/4]` and result from `h-64` to `aspect-[3/4]`.

### 7. Saved outfits not syncing to merchant's product catalog
**Problem**: The `widget-outfits/save` endpoint saves outfit data as JSON but doesn't link back to the merchant's catalog in a way the merchant can view.
**Fix**: The saved outfits already reference product IDs from the `products` table. To make them visible to merchants, we need to:
- Create a merchant-facing "Customer Outfits" view on the dashboard that queries `saved_outfits` by `brand_id`.
- Replace the current "Saved Outfits" nav item (which shows mock data in `Wishlist.tsx`) with this real data view.

## Technical Changes

### Files to modify:
1. **`src/components/layout/DashboardLayout.tsx`** -- Remove "Outfit Generator" and "Saved Outfits" from sidebar nav. Replace with "Customer Outfits" that shows saved outfits from customers.
2. **`src/pages/WidgetPreview.tsx`** -- Read `brand_id` from URL query params and pass to `CustomerWidget`.
3. **`src/components/widget/tabs/TryOnTab.tsx`** -- Change image containers to portrait `aspect-[3/4]` layout.
4. **`src/components/VirtualTryOn.tsx`** -- Change image containers to portrait `aspect-[3/4]` layout.
5. **`supabase/functions/widget-loader/index.ts`** -- Add cache-busting parameter to favicon URL.
6. **`src/pages/Wishlist.tsx`** -- Refactor to show real saved outfits from `saved_outfits` table by brand_id (merchant's customer outfits view).

