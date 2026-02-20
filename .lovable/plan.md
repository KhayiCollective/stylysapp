

## Plan: Add Cart Button to Try-On Tab + Speed Up Virtual Try-On

### What's changing

**1. "Add All to Cart" on the Try-On tab**

The Try-On tab currently shows the outfit items and a "Try It On" button, but no way to purchase. We'll add an "Add All to Cart" button below the generate button, reusing the same cart logic already working in the Outfits tab.

This requires passing `shopify_variant_id` through to the TryOnTab (currently only `name`, `imageUrl`, and `category` are passed from OutfitsTab).

**2. Faster virtual try-on generation**

The current flow is slow because:
- Product images are converted from URL to base64 **twice** (once on the client in TryOnTab, then again on the server in the edge function)
- The AI model fallback chain tries up to 3 models, and if the first attempt returns no image, it retries with all 3 models again (up to 6 AI calls total)
- We'll switch the primary model to `google/gemini-2.5-flash-image` (faster) and reduce retries

---

### Technical Details

**Files to modify:**

1. **`src/components/widget/tabs/OutfitsTab.tsx`** -- Update `handleTryOn` to also pass `shopify_variant_id`, `price`, and `id` alongside existing fields.

2. **`src/components/widget/tabs/TryOnTab.tsx`**
   - Expand `OutfitItemProp` interface to include `shopify_variant_id`, `price`, and `id`
   - Add an "Add All to Cart" button (using same pattern as OutfitsTab's `handleAddAllToCart`)
   - Remove the client-side `imageUrlToBase64` conversion (the edge function already handles this, so it's duplicated work)

3. **`src/components/widget/CustomerWidget.tsx`** and **`src/components/widget/InlineCustomerWidget.tsx`** -- Update the `selectedOutfitItems` state type to include the new fields.

4. **`supabase/functions/virtual-tryon/index.ts`**
   - Reorder model fallback: put `google/gemini-2.5-flash-image` first (faster), then `google/gemini-3-pro-image-preview` second
   - Limit retry to only 1 model instead of cycling all 3 again
   - Skip redundant base64 conversion for images already in data URI format

