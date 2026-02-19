

# Fix: Virtual Try-On — Model-Specific Configuration

## Problem

All three models fail for different reasons:

1. **`google/gemini-3-pro-image-preview`** -- 500 gateway outage (temporary, out of our control)
2. **`google/gemini-3-flash-preview`** -- 404 because it does NOT support `modalities: ["image", "text"]`
3. **`openai/gpt-5`** -- 400 because it does NOT accept the `modalities` parameter at all

The `callAI` function blindly sends `modalities: ["image", "text"]` to every model, which only works with the one model that's currently down.

## Solution

Two changes to `supabase/functions/virtual-tryon/index.ts`:

### Change 1: Make `callAI` conditionally include `modalities`

Only send `modalities: ["image", "text"]` for models that support it (the `gemini-3-*-image-preview` model). For other models, omit it entirely.

```typescript
async function callAI(apiKey: string, contentParts: any[], model: string) {
  const body: any = {
    model,
    messages: [{ role: "user", content: contentParts }],
  };
  // Only image-preview models support the modalities parameter
  if (model.includes("image-preview")) {
    body.modalities = ["image", "text"];
  }
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return response;
}
```

### Change 2: Update the fallback model list

Replace `google/gemini-3-flash-preview` (which doesn't support image output) with `google/gemini-2.5-flash-image`, which is specifically designed for image generation.

```typescript
const models = [
  "google/gemini-3-pro-image-preview",  // Primary image model
  "google/gemini-2.5-flash-image",       // Dedicated image generation model
  "openai/gpt-5",                        // General multimodal fallback
];
```

### Why This Fixes It

- When `gemini-3-pro-image-preview` is down (500), it falls through to `gemini-2.5-flash-image` which is a dedicated image model and won't reject the request
- `openai/gpt-5` will no longer get the unsupported `modalities` parameter, so it can attempt the request too
- No extra credits wasted on requests that are guaranteed to fail

### Files to Modify

- `supabase/functions/virtual-tryon/index.ts` -- update `callAI` function and models array (both initial attempt and retry)

