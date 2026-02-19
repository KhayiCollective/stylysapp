

# Fix: Virtual Try-On — Correct `modalities` Parameter for All Image Models

## Problem

The `callAI` function only adds `modalities: ["image", "text"]` when the model name contains `"image-preview"`. But `google/gemini-2.5-flash-image` also **requires** this parameter to generate images — its name contains `"flash-image"`, not `"image-preview"`, so it never gets the parameter.

Result:
- `gemini-3-pro-image-preview` — gateway 500 (temporary outage, out of our control)
- `gemini-2.5-flash-image` — likely fails because it's missing the required `modalities` parameter
- `openai/gpt-5` — responds with text description instead of an image (it cannot generate images)

## Solution

One small change in `supabase/functions/virtual-tryon/index.ts`:

### Update the `modalities` condition (line 108)

Change from:
```typescript
if (model.includes("image-preview")) {
```

To:
```typescript
if (model.includes("image-preview") || model.includes("flash-image")) {
```

This ensures `google/gemini-2.5-flash-image` receives the `modalities: ["image", "text"]` parameter it needs to generate images, while still keeping it off for `openai/gpt-5`.

### Why this should work

- When `gemini-3-pro-image-preview` is down (500), the fallback `gemini-2.5-flash-image` will now get the correct parameters to actually generate an image
- `openai/gpt-5` remains as a last resort — it returns text but won't crash
- No other files need changes

### Files to modify

- `supabase/functions/virtual-tryon/index.ts` — line 108, update the condition

