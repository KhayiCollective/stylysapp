
# Deploy & Diagnose Shopify OAuth Function

## Current Status

After investigating, I found the core issue:

| Edge Function | Status | Reason |
|---------------|--------|--------|
| `account-bootstrap` | ✅ Working | Uses modern `Deno.serve()` |
| `shopify-oauth` | ❌ 404 Error | Uses deprecated `serve()` from std library |

The analytics logs confirm `shopify-oauth` has no `function_id` (meaning it failed to build/deploy), while `account-bootstrap` has a valid deployment ID and works correctly.

## Root Cause

The `shopify-oauth` function uses an outdated import pattern:

```typescript
// OLD - causing deployment failure
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
serve(async (req) => { ... });
```

The edge runtime expects the modern pattern:

```typescript
// NEW - works correctly
Deno.serve(async (req) => { ... });
```

## Implementation Plan

### Step 1: Update shopify-oauth to modern Deno.serve pattern

Modify `supabase/functions/shopify-oauth/index.ts`:
- Remove the `serve` import from `std/http/server.ts`
- Replace `serve(async (req) => {...})` with `Deno.serve(async (req) => {...})`
- Update the Supabase client import to use the same pattern as `account-bootstrap`

### Step 2: Deploy the updated function

After the code change, deploy the function and verify it's accessible.

### Step 3: Run OAuth diagnostics

Test these endpoints:
- `GET /shopify-oauth?action=health` - Should return version and timestamp
- `GET /shopify-oauth?action=test` - Should return configuration status

### Step 4: Verify Shopify credentials are configured

The test endpoint will confirm whether `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` are set.

## Technical Details

Changes to `supabase/functions/shopify-oauth/index.ts`:

```typescript
// Remove this line:
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// Update import:
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Replace serve() call at end of file:
// FROM:  serve(async (req) => { ... });
// TO:    Deno.serve(async (req) => { ... });
```

## Expected Outcome

After implementation:
- Health endpoint returns: `{ "status": "ok", "version": "1.0.3", "timestamp": "..." }`
- Test endpoint returns: `{ "status": "ok", "version": "1.0.3", "configured": true/false }`
- The Shopify OAuth flow will work end-to-end for connecting your dev store
