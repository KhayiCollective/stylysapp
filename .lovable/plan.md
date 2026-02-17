

# Implement Merchant/Customer Separation

## Summary
Build the remaining pieces from the approved architecture: customer auth edge function, outfit generation edge function, and frontend updates to use real catalog data. Analytics, rules, and widget demo stay in the merchant dashboard.

## Step 1: Add JWT Secret
A `WIDGET_JWT_SECRET` needs to be configured. You'll be prompted to paste in a random string (you can generate one with a password generator -- just make it 64+ characters).

## Step 2: Edge Function -- `widget-customer-auth`
New backend function handling customer signup, login, and session validation. Completely separate from the merchant login system.

- **Signup**: Takes email + password + brand_id, hashes password with bcrypt, creates a `customer_accounts` row, returns a signed JWT
- **Login**: Verifies email/password, returns JWT
- **Me**: Validates JWT, returns customer profile
- No Shopify credentials or brand name required from the customer
- JWT is signed with the secret from Step 1

## Step 3: Edge Function -- `widget-outfits`
New backend function for outfit generation and saving, using real catalog products:

- **Generate**: Fetches products from the `products` table by brand_id, calls the existing AI outfit generation logic (reuses the prompt from `generate-outfits`)
- **Get saved**: Returns a customer's saved outfits (requires customer JWT)
- **Save**: Persists an outfit to `saved_outfits` table (requires customer JWT)
- **Delete**: Removes a saved outfit

## Step 4: Update Outfit Generator (Merchant Dashboard)
Replace the hardcoded `mockProducts` array in `src/pages/OutfitGenerator.tsx` with a real database query:

- Fetch products from the `products` table filtered by the merchant's brand_id
- Show a loading state while products load
- Show an empty state if no products are synced yet ("Sync your catalog first")
- Keep the existing anchor-selection and outfit-generation UI unchanged
- Call the existing `generate-outfits` edge function with real product data

## Step 5: Update Widget Demo (Merchant Dashboard)
Replace mock data in `src/pages/Widget.tsx` with real catalog products:

- Fetch products from `products` table by brand_id
- Use the first product as the anchor, generate outfit suggestions from the catalog
- Keep the "Widget Demo" badge and "Back to Dashboard" link
- Analytics stays in the merchant dashboard (no changes needed)

## Step 6: Update Widget Account Tab (Customer-Facing)
Update `src/components/widget/tabs/AccountTab.tsx`:

- Add password field for signup/login
- Call `widget-customer-auth` edge function for real authentication
- Store the customer JWT in localStorage
- Show real customer profile when logged in
- Handle errors (duplicate email, wrong password, etc.)

## Step 7: Update Widget Outfits Tab (Customer-Facing)
Update `src/components/widget/tabs/OutfitsTab.tsx`:

- Call `widget-outfits/generate` to get AI-curated outfits from the real catalog
- Save/unsave outfits via `widget-outfits/save` and `widget-outfits/delete`
- Show saved outfit count from real data
- Require customer login for saving (prompt to sign in if not logged in)

## Step 8: Config Updates
Add the new edge functions to `supabase/config.toml` with `verify_jwt = false` (they use their own JWT system, not the merchant auth).

## What Stays Unchanged
- **Analytics** -- remains in the merchant dashboard only
- **Rules page** -- merchant dashboard only
- **Widget demo** -- merchant dashboard, but now with real catalog data
- **Merchant auth** -- existing email/password login unchanged
- **Product sync** -- Shopify/WooCommerce sync unchanged
- **Widget loader** -- script tag installation unchanged
- **Routing** -- no route changes needed

## Technical Details

### Customer JWT Structure
```text
{
  "sub": "<customer_account_id>",
  "brand_id": "<brand_id>",
  "email": "<email>",
  "exp": <1 hour from now>
}
```

### Edge Function Auth Flow
```text
Customer opens widget
  --> Signup/Login form
  --> POST widget-customer-auth/signup or /login
  --> Returns JWT token
  --> Stored in localStorage
  --> Passed as Authorization header to widget-outfits calls
```

### Products Access
The `products` table already has a public SELECT RLS policy (`Widget can view products by brand_id`) created in the previous migration, so the edge functions can read products using the service role key.

