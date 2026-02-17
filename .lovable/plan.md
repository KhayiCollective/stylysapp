

# Update SHOPIFY_CLIENT_SECRET

## What we'll do

Update the `SHOPIFY_CLIENT_SECRET` stored in your backend secrets with the value you just provided. Then retry the Shopify OAuth flow to confirm the connection works.

## Steps

1. **Update the secret** using the secrets management tool with the value: `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`
2. **Retry the OAuth flow** at `/connect-shopify` to verify the fix
3. **Check the logs** to confirm the token exchange succeeds

## Technical Details

- The secret `SHOPIFY_CLIENT_SECRET` already exists and will be overwritten with the new value
- No code changes are needed — the edge function already reads this secret via `Deno.env.get("SHOPIFY_CLIENT_SECRET")`
- After updating, the next OAuth attempt should complete the token exchange successfully

