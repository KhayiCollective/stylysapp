

## Analysis

The standalone `VirtualTryOn` component (`src/components/VirtualTryOn.tsx`) sends this payload to the `virtual-tryon` edge function:
```json
{ "userImageBase64": "...", "productImageUrl": "...", "productCategory": "clothing" }
```

But the edge function now expects:
```json
{ "userImageBase64": "...", "outfitItems": [{ "name": "...", "imageUrl": "...", "category": "..." }] }
```

This means the standalone VirtualTryOn (used on the OutfitGenerator page) is **broken** — it sends `productImageUrl` but the function destructures `outfitItems` and will reject it as empty.

## Fix

**Option A (Recommended):** Update the `VirtualTryOn` component to send the correct `outfitItems` format:

**File: `src/components/VirtualTryOn.tsx`**
- Change the `generateTryOn` function to wrap the single product into the `outfitItems` array format:
  ```js
  body: {
    userImageBase64: userImage,
    outfitItems: [{ name: productName || "Product", imageUrl: productImage, category: "clothing" }]
  }
  ```
- Remove the old `productImageUrl` / `productCategory` fields

This is a one-line structural change — no edge function modifications needed.

## Files Modified
- `src/components/VirtualTryOn.tsx` — fix payload format to match edge function's expected `outfitItems` schema

