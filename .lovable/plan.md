

# Fix: Virtual Try-On "AI Services Temporarily Unavailable"

## Problem

The `virtual-tryon` backend function is configured with `verify_jwt = true`, which means it requires a valid Supabase authentication token. However, the Virtual Try-On is triggered from the customer widget, which does not use Supabase auth -- it uses a custom customer token. The request is being rejected at the gateway level before the function code even executes, resulting in no logs and a generic "temporarily unavailable" error.

## Fix

### 1. Update `supabase/config.toml`

Change the virtual-tryon function to `verify_jwt = false` so the request can reach the function code:

```
[functions.virtual-tryon]
verify_jwt = false
```

### 2. Update `src/components/widget/tabs/TryOnTab.tsx`

The component currently calls the function using `supabase.functions.invoke()`, which automatically attaches the Supabase anon key. This should work once JWT verification is disabled. No changes needed here -- the existing code is fine.

## Why This Fixes It

- The widget doesn't have a Supabase user session, so JWT verification fails silently at the gateway
- Setting `verify_jwt = false` lets the request through to the function code
- This is the same pattern used by all other widget-facing functions (`widget-outfits`, `widget-customer-auth`, `widget-loader`, etc.) which all have `verify_jwt = false`

## Files to Modify

- `supabase/config.toml` -- set `verify_jwt = false` for virtual-tryon (one-line change)

