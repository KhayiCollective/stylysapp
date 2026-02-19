

# Fix: Widget Outfits "AI Service Temporarily Unavailable"

## Problem

The `widget-outfits` edge function is getting a 500 error from the AI gateway when calling `google/gemini-2.5-flash`. The current code only logs the status code (`AI error: 500`) but not the response body, so we can't see the actual reason for the failure.

## Root Cause

The AI gateway is returning 500 errors. This could be:
- A transient issue with the `google/gemini-2.5-flash` model
- The request payload being too large (50 products serialized as JSON in the prompt)
- A rate limit or quota issue surfacing as 500

## Fixes

### 1. Add detailed error logging (`supabase/functions/widget-outfits/index.ts`)

Log the full error response body from the AI gateway so we can see the actual failure reason:

```typescript
if (!aiResp.ok) {
  const errBody = await aiResp.text();
  console.error("AI error:", aiResp.status, errBody);
  return json({ error: "AI service temporarily unavailable" }, 500);
}
```

### 2. Add retry with fallback model

If `google/gemini-2.5-flash` fails, retry once with `google/gemini-2.5-flash-lite` as a fallback. This provides resilience against single-model outages.

### 3. Reduce prompt size

The current code sends up to 50 products with all fields. Trim this to essential fields only (id, name, category, color) and reduce the limit to 30 products. Smaller prompts are less likely to cause gateway errors.

### 4. Add client-side retry in OutfitsTab

In `OutfitsTab.tsx`, if the first request fails with a 500 error, retry once automatically after a short delay before showing the error to the user.

## Files to Modify

- `supabase/functions/widget-outfits/index.ts` -- add error body logging, model fallback retry, reduce payload size
- `src/components/widget/tabs/OutfitsTab.tsx` -- add automatic retry on 500 errors

