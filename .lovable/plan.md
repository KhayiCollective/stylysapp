## Goal
Diagnose why Catalog / Rules / Settings still spin inside the Shopify admin iframe after the `embedded-data` edge function was added.

## Scope
Only the three embedded component files are modified. No other files touched.

## Steps

1. **Confirm edge function deployment**
   - Function name: `embedded-data`
   - Endpoint: `https://mggxvtfgakplzzpcclte.supabase.co/functions/v1/embedded-data`
   - Verify deployment by tailing logs (`supabase--edge_function_logs` for `embedded-data`) and, if needed, a direct `supabase--curl_edge_functions` POST with `{ shop, host, resource: "brand" }`. Report the result back in chat — no code change for this step.

2. **`src/components/embedded/EmbeddedCatalog.tsx`** — inside the existing `useEffect`'s async IIFE:
   - Add `console.log('[EmbeddedCatalog] invoking embedded-data', { shop, host: !!host, hmac: !!hmac, resource: 'products' })` immediately before `supabase.functions.invoke(...)`.
   - Add `console.log('[EmbeddedCatalog] invoke returned', { hasData: !!data, hasError: !!error, brand: data?.brand?.id ?? null, productCount: data?.products?.length ?? 0 })` immediately after.
   - Promote the existing `console.warn` lines for the error branch and the catch branch to `console.error` so they show up as red in DevTools, keeping their current messages and including the error object.

3. **`src/components/embedded/EmbeddedRules.tsx`** — same pattern:
   - `console.log('[EmbeddedRules] invoking embedded-data', { shop, host: !!host, hmac: !!hmac, resource: 'rules' })` before invoke.
   - `console.log('[EmbeddedRules] invoke returned', { hasData: !!data, hasError: !!error, brand: data?.brand?.id ?? null, ruleCount: data?.rules?.length ?? 0 })` after invoke.
   - Convert error-branch and catch-branch `console.warn` calls to `console.error`.

4. **`src/components/embedded/EmbeddedSettings.tsx`** — same pattern:
   - `console.log('[EmbeddedSettings] invoking embedded-data', { shop, host: !!host, hmac: !!hmac, resource: 'settings' })` before invoke.
   - `console.log('[EmbeddedSettings] invoke returned', { hasData: !!data, hasError: !!error, brand: data?.brand?.id ?? null, productCount: data?.productCount ?? null })` after invoke.
   - Convert error-branch and catch-branch `console.warn` calls to `console.error`.

## Out of scope
- No changes to the edge function code, RLS, EmbeddedDashboard, EmbeddedApp, or any other file.
- No new components, no behavior changes — logging only.

## What you'll see after
Open the Shopify admin iframe and click Catalog / Rules / Settings. DevTools should show, per tab:
- `[Embedded…] invoking embedded-data {...}` confirming the call fires (proves the component reaches the network step).
- `[Embedded…] invoke returned {...}` showing whether `data` came back, whether `error` is set, and what the edge function returned.
- A red `console.error` if the function 401s, 500s, or the network call throws — which will tell us exactly which of these is the cause (not deployed, session not verified, brand not found, or network).
