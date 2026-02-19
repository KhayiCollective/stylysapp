

# Fix: Virtual Try-On — Use Image-Capable Fallback Models

## Problem

The current fallback chain fails completely:
1. `google/gemini-3-pro-image-preview` -- returns 500 (gateway outage)
2. `google/gemini-2.5-pro` -- returns 404 because it does NOT support image output modalities

The function needs fallback models that actually support `modalities: ["image", "text"]`.

## Fix

### File: `supabase/functions/virtual-tryon/index.ts`

**Change 1 (line 173):** Update the models array to use image-capable models:

```typescript
const models = [
  "google/gemini-3-pro-image-preview",
  "google/gemini-3-flash-preview",
  "openai/gpt-5",
];
```

- `google/gemini-3-flash-preview` is the fast next-gen Google model and should support image generation
- `openai/gpt-5` is a powerful all-rounder that supports multimodal output including images

This gives three fallback options instead of two, and all three support image output.

### No other files need changes

The client-side code (`TryOnTab.tsx`, `VirtualTryOn.tsx`) is already correct. Only the edge function model list needs updating.

