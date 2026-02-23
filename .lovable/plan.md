
# Build Outfit Around a Product from the Widget

## Overview
When a customer clicks a product (on the grid or detail page), a "Build Outfit" button will open the STYLYS widget on the Outfits tab, pre-loaded with outfits generated around that specific product as the anchor.

## How It Works

1. **Extend the ShopLayout context** to expose a `buildOutfitAround(productId, productName)` function alongside the existing `openAccountTab`
2. **Add a "Build Outfit" button** on `ProductCard` (appears on hover next to "Add to Cart") and on `ProductDetail` (next to the main "Add to Cart" button)
3. **Pass anchor product info through** `ShopLayout` -> `CustomerWidget` -> `OutfitsTab` via new props
4. **Update `OutfitsTab`** to accept an optional `anchorProductId` and pass it to the `widget-outfits/generate` endpoint (which already supports it)

## Technical Details

### File: `src/components/shop/ShopLayout.tsx`
- Extend `WidgetControl` interface to include `buildOutfitAround: (productId: string, productName: string) => void`
- Add state for `anchorProductId` and `anchorProductName`
- When called: set anchor state, switch widget tab to "outfits", open widget
- Pass `anchorProductId` to `CustomerWidget` as a new prop
- Clear anchor when widget closes

### File: `src/components/widget/CustomerWidget.tsx`
- Accept new `anchorProductId?: string` prop
- Pass it through to `OutfitsTab`

### File: `src/components/widget/tabs/OutfitsTab.tsx`
- Accept new `anchorProductId?: string` prop
- Pass `anchor_product_id` in the `widget-outfits/generate` request body (already supported by the edge function)
- When `anchorProductId` changes, re-fetch outfits automatically
- Show a banner like "Outfits built around [product name]" with a clear/reset button

### File: `src/components/shop/ProductCard.tsx`
- Add a "Style Me" sparkle button on hover (alongside "Add to Cart")
- On click: call `buildOutfitAround(productId, productTitle)` from the `WidgetControl` context
- The product ID used will be the Shopify node ID mapped back to the products table

### File: `src/pages/ProductDetail.tsx`
- Add a "Build Outfit" button near the existing "Add to Cart" button
- Uses same `buildOutfitAround` context call

### Edge Function: No changes needed
The `widget-outfits/generate` endpoint already accepts `anchor_product_id` and includes the anchor product in all generated outfits.
