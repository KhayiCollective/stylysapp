

# Auto-Recommend Outfits on Product Detail Page

## What This Does

When a customer views any product in the shop, they will automatically see AI-generated outfit recommendations below the product details. The outfits are built around the product they are viewing as the "anchor" item, making it easy to shop a complete look. Each recommended item is clickable to add to cart, and customers can also try on the full outfit via Virtual Try-On.

## How It Will Work

1. When the Product Detail page loads, it fetches companion products from the synced catalog (database `products` table)
2. It calls the existing `generate-outfits` backend function with the current product as the anchor
3. A new "Complete the Look" section appears below the product info showing 2-3 outfit recommendations
4. Each outfit shows its items as clickable cards with "Add All to Cart" functionality
5. Customers can click any outfit item to try it on virtually

## Changes

### New Component: `src/components/shop/RecommendedOutfits.tsx`
- Accepts the current product (title, handle, image, category) as props
- Fetches complementary products from the database using the brand's catalog
- Calls the `generate-outfits` backend function with the current product as anchor
- Displays 2-3 outfit cards in a horizontal scroll or grid
- Each outfit card shows:
  - Outfit name and occasion
  - Product thumbnails in a grid
  - Total outfit price
  - "Add All to Cart" button
  - "Try On" button (links to Virtual Try-On)
- Shows a loading skeleton while generating
- Gracefully handles cases where no products are in the catalog (shows nothing)

### Modified: `src/pages/ProductDetail.tsx`
- Import and render `RecommendedOutfits` below the existing product info grid
- Pass the current product's details (title, first image, handle) to the component
- Add Virtual Try-On sidebar or section alongside the recommendations
- The recommendations section appears after the main product content with a "Complete the Look" heading

### Modified: `supabase/functions/generate-outfits/index.ts`
- No changes needed -- the existing function already supports `anchorProductId` and returns outfit combinations. It will be called from the frontend with the catalog products and current product as anchor.

## Technical Details

- The `RecommendedOutfits` component will query the `products` table to get the brand's catalog (using the brand slug or ID from the shop context)
- Since the shop pages are public-facing (no auth), the component will call `generate-outfits` via `supabase.functions.invoke` with the product list
- Products table already has an RLS policy allowing public reads (`Widget can view products by brand_id` with `true` expression)
- The outfit generation uses the existing Lovable AI integration (Gemini 2.5 Flash) -- no new API keys needed
- Cart integration reuses the existing `useCartStore` for "Add All to Cart"
- Results are cached in component state to avoid re-generating on every render

### Files to Create
- `src/components/shop/RecommendedOutfits.tsx` -- the outfit recommendation section

### Files to Modify
- `src/pages/ProductDetail.tsx` -- add the RecommendedOutfits section below product details

