

## Analysis

I identified three issues causing the virtual try-on to not reflect the actual customer:

### Issue 1: Product image conversion crashes (critical)
The `imageUrlToBase64` function in the edge function uses `btoa(String.fromCharCode(...new Uint8Array(buf)))` which causes a **`RangeError: Maximum call stack size exceeded`** for large Shopify product images (visible in the logs). This means product images silently fall back to raw URLs instead of base64, and the AI model receives broken/missing image data. With corrupted input, the model can't properly distinguish the customer photo from product photos.

### Issue 2: Prompt needs stronger identity preservation
The current prompt says "Maintain the person's face, body shape, and pose" but doesn't emphasize enough that the output must be a recognizable likeness of the specific person. The AI sometimes generates a generic model instead.

### Issue 3: Standalone VirtualTryOn component still broken
`src/components/VirtualTryOn.tsx` (line 50) still sends `{ productImageUrl, productCategory }` instead of `{ outfitItems: [...] }`, so it will always fail validation.

## Plan

### A. Fix `imageUrlToBase64` in edge function
**File:** `supabase/functions/virtual-tryon/index.ts`

Replace the spread-based `btoa` call with a chunked encoding approach that handles large images:

```typescript
async function imageUrlToBase64(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return url;
    const contentType = resp.headers.get("content-type") || "image/jpeg";
    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // Chunked encoding to avoid stack overflow
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const b64 = btoa(binary);
    return `data:${contentType};base64,${b64}`;
  } catch (e) {
    console.error(`Error converting image: ${url}`, e);
    return url;
  }
}
```

### B. Strengthen identity-preservation in prompt
**File:** `supabase/functions/virtual-tryon/index.ts`

Update `buildPrompt` requirements to emphasize identity:

```
Requirements:
1. CRITICAL: The output image MUST be the EXACT SAME PERSON from Image 1 — 
   preserve their face, skin tone, hair, facial features, and body exactly as shown.
   Do NOT substitute a different model or generic person.
2. Dress the person in ALL the extracted garments together as one cohesive outfit
3. Maintain the person's exact pose and proportions from Image 1
4. Natural lighting, realistic fabric draping
5. Keep the original background or use a clean studio background
```

### C. Fix standalone VirtualTryOn payload
**File:** `src/components/VirtualTryOn.tsx`

Change line 50 from:
```js
body: { userImageBase64: userImage, productImageUrl: productImage, productCategory: "clothing" }
```
To:
```js
body: { 
  userImageBase64: userImage, 
  outfitItems: [{ name: productName || "Product", imageUrl: productImage, category: "clothing" }] 
}
```

### Files Modified
- `supabase/functions/virtual-tryon/index.ts` — fix base64 conversion crash + improve prompt
- `src/components/VirtualTryOn.tsx` — fix payload format

