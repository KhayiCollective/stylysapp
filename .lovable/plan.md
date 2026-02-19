

# Fix: Virtual Try-On AI Gateway 500 Error

## Problem

The `virtual-tryon` edge function reaches the AI gateway successfully, but `google/gemini-3-pro-image-preview` is returning a 500 internal server error with an empty message. The function has no fallback model, so it fails immediately.

## Fix

### File: `supabase/functions/virtual-tryon/index.ts`

Add a fallback model sequence, similar to the pattern already used in `widget-outfits`:

1. Try `google/gemini-3-pro-image-preview` (primary, supports image generation)
2. Fall back to `google/gemini-2.5-pro` (also supports image output via modalities)
3. If both fail, return the error

### Technical Details

Update the `serve` handler (around lines 173-199) to loop through models instead of using a single hardcoded model:

```typescript
const models = ["google/gemini-3-pro-image-preview", "google/gemini-2.5-pro"];
let response: Response | null = null;

for (const model of models) {
  console.log(`Trying model: ${model}`);
  response = await callAI(LOVABLE_API_KEY, contentParts, model);
  if (response.ok) break;
  const errorText = await response.text();
  console.error(`AI gateway error (${model}):`, response.status, errorText);
}
```

Apply the same fallback pattern to the retry attempt (lines 224-237).

### Files to Modify

- `supabase/functions/virtual-tryon/index.ts` -- add model fallback loop for both initial and retry attempts

