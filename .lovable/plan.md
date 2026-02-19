
# Fix: Outfits Tab Missing API Key Header

## Problem

The `OutfitsTab.tsx` component calls the `widget-outfits` edge function without including the required `apikey` header. The Supabase gateway rejects requests that don't include this header, even when `verify_jwt = false`. This causes the "Edge Function returned a non-2xx status code" error.

The backend function itself works correctly -- direct testing confirmed it returns valid outfit data with product images and prices.

## Fix

### File: `src/components/widget/tabs/OutfitsTab.tsx`

Add the `apikey` header to both the initial fetch call and the retry fetch call for the `/generate` endpoint:

```typescript
headers: { 
  "Content-Type": "application/json",
  "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY 
}
```

This needs to be applied in two places:
1. The initial fetch to `/widget-outfits/generate` (line 63-67)
2. The auto-retry fetch to `/widget-outfits/generate` (line 71-75)

No backend changes needed -- the edge function is working correctly.
