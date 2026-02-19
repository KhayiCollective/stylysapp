

# Fix Virtual Try-On Image Generation

## Problem

The AI model (`google/gemini-2.5-flash-image`) is returning text instead of generating an image. The logs show "No image generated, returning text response" but we don't know the exact reason because the text response isn't logged.

## Root Causes (likely)

1. **Safety filters on real-person photos** -- Gemini's image generation mode sometimes refuses to modify photos of real people
2. **External image URLs** -- product images may be external URLs (e.g., Shopify CDN) that the model can't fetch; they need to be converted to base64 first
3. **No retry logic** -- sometimes the model just needs a second attempt

## Fixes

### 1. Add diagnostic logging

Log the actual text response from the AI so we can see why it refused:
```
console.log("AI text response:", textResponse?.substring(0, 500));
console.log("Full AI response structure:", JSON.stringify(Object.keys(aiResponse.choices?.[0]?.message || {})));
```

### 2. Convert external product image URLs to base64

Before sending to the AI, fetch any external image URLs and convert them to base64 data URIs. The model handles inline base64 images much more reliably than external URLs.

- For each outfit item, check if `imageUrl` starts with `http`
- If so, fetch the image and convert to `data:image/jpeg;base64,...`
- This ensures the model can actually "see" the product images

### 3. Upgrade to the Pro image model

Switch from `google/gemini-2.5-flash-image` to `google/gemini-3-pro-image-preview` which is higher quality and more reliable at compositing tasks involving people.

### 4. Add automatic retry

If the first attempt returns text-only (no image), retry once with a simplified prompt that emphasizes "you MUST output an image."

### 5. Improve the prompt for safety compliance

Reword the prompt to avoid triggering safety filters:
- Instead of "Generate a composite image showing the person," use "Create a fashion visualization showing these clothing items styled on a figure matching the uploaded photo"
- Add "This is for fashion retail product visualization purposes"

## Files to Modify

- `supabase/functions/virtual-tryon/index.ts` -- all changes are in this one file:
  - Add image URL-to-base64 conversion helper
  - Switch model to `google/gemini-3-pro-image-preview`
  - Add retry logic (1 retry on text-only response)
  - Update prompt wording for safety compliance
  - Add detailed logging of AI responses

## No Frontend Changes Needed

The `TryOnTab.tsx` component already handles the response correctly -- once the backend generates an image, it will display properly.

