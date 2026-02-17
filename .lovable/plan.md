

# Fix Shopify OAuth "Authorization Failed" Error

## Problem

The Shopify OAuth token exchange is failing with HTTP 400 on every attempt. The edge function logs show `Token exchange failed with status 400` but does not capture Shopify's actual error response body, making it impossible to diagnose the root cause.

A 400 from Shopify during token exchange typically means one of:
- Incorrect `SHOPIFY_CLIENT_ID` or `SHOPIFY_CLIENT_SECRET`
- The authorization code expired before it was exchanged (codes are single-use and short-lived)
- A mismatch between the `redirect_uri` used during authorization and the one registered in the Partner Dashboard

## Plan

### Step 1: Add diagnostic logging to the edge function

Update `supabase/functions/shopify-oauth/index.ts` to capture and log the response body from Shopify when the token exchange fails. This will reveal the exact error message Shopify returns (e.g., "invalid client credentials", "authorization code was not found or was already used").

Currently the code only logs:
```
Token exchange failed with status 400
```

After the fix it will also log the response body (without exposing it to the client).

### Step 2: Verify Shopify credentials

The `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` secrets need to match the credentials shown in your Shopify Partner Dashboard under **Apps > STYLYS > Client credentials**.

- If they don't match, we'll update them using the secrets tool.

### Step 3: Add the redirect URI to Shopify Partner Dashboard

Ensure this exact URL is whitelisted in the Shopify Partner Dashboard under **App setup > Allowed redirection URL(s)**:

```
https://stylysapp.lovable.app/connect-shopify
```

---

### Technical Details

**File changed:** `supabase/functions/shopify-oauth/index.ts`

In the callback handler, after the `tokenResponse` check on line 152, read and log the response body before returning the error:

```typescript
if (!tokenResponse.ok) {
  const errorBody = await tokenResponse.text();
  console.error(`[SHOPIFY-OAUTH] Token exchange failed with status ${tokenResponse.status}, body: ${errorBody}`);
  return new Response(
    JSON.stringify({ error: CLIENT_ERRORS.AUTH_FAILED }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

This is a one-line addition that will immediately reveal why Shopify is rejecting the token exchange on the next attempt.

