
# Fix: Double OAuth Callback Execution

## Problem
The edge function logs show the OAuth callback being called twice in rapid succession:
- First call succeeds (storefront token created, connection saved, webhooks registered)
- Second call fails with "The authorization code was not found or was already used"

This happens because the `useEffect` in `ShopifyConnect.tsx` that detects the `code`, `shop`, and `state` URL parameters runs twice (React StrictMode double-invocation or component re-render), sending the authorization code to the backend twice. Shopify authorization codes are single-use, so the second attempt always fails -- and since the second result overwrites the first, the user sees an error even though the connection actually succeeded.

## Solution

### 1. Add a processing guard ref in ShopifyConnect.tsx
**File:** `src/pages/ShopifyConnect.tsx`

Add a `useRef` flag (`callbackProcessed`) that is set to `true` the first time the OAuth callback is detected. On subsequent effect runs, the flag prevents re-processing. This is the standard React pattern for preventing double-execution of one-time side effects.

### 2. Skip the health check before the callback
**File:** `src/pages/ShopifyConnect.tsx`

The current flow calls `checkEdgeFunctionHealth()` before `shopify-oauth?action=callback`. This adds an extra network round-trip and delays the callback, but more importantly, the health check itself is what triggers another boot of the edge function, contributing to timing issues. Remove the health check from the callback path -- if the callback fails, the error will be shown anyway.

### 3. Immediately clear URL parameters
**File:** `src/pages/ShopifyConnect.tsx`

Move the `window.history.replaceState({}, '', '/connect-shopify')` call to happen immediately when the callback is detected (before making the API call), not after success. This prevents the browser from re-triggering the effect with the same URL parameters if the component re-renders.

---

## Technical Details

Changes are limited to `src/pages/ShopifyConnect.tsx`:

1. Add `import { useRef }` and create `const callbackProcessed = useRef(false)`
2. At the top of the callback detection block (around line 114), add: `if (callbackProcessed.current) return; callbackProcessed.current = true;`
3. Move `window.history.replaceState({}, '', '/connect-shopify')` from line 159 to right after setting `callbackProcessed.current = true`
4. Remove the `checkEdgeFunctionHealth()` call from the callback processing path (lines 134-138)

No edge function changes are needed -- the backend is working correctly; the problem is purely that the frontend sends the request twice.
