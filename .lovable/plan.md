

# Fix: Separate Customer Auth from Merchant Auth on Storefront

## Problem
The storefront's "Account" link (`/shop/account`) currently renders a static page with mock data and no authentication. Meanwhile, the `CustomerWidget` sidebar already has the correct separate JWT-based auth system (`widget-customer-auth`), but it's not used on the shop pages. Customers trying to log in from the storefront have no proper auth flow -- or get confused with the merchant `/auth` page.

## Solution

### 1. Add CustomerWidget to Shop Pages
- Import and render the `CustomerWidget` component inside `ShopLayout.tsx` so it appears on all shop pages
- This gives every storefront page access to the customer auth system (signup/login with name, email, password via custom JWT)

### 2. Redirect `/shop/account` to the Widget
- Change the "Account" link in `ShopHeader.tsx` to open the widget's Account tab instead of navigating to a separate page
- This can be done by passing an `onAccountClick` callback from `ShopLayout` to `ShopHeader`, or by making the Account link simply trigger the widget to open

### 3. Update CustomerAccount Page
- Replace the current mock-data `CustomerAccount.tsx` page with a full-page version that uses the same custom JWT auth from `widget-customer-auth`
- OR remove it entirely and rely on the widget sidebar for all customer account interactions (simpler approach)

## Recommended Approach (Simplest)
- Add `CustomerWidget` to `ShopLayout` (replaces or sits alongside `StylingChatbot`)
- Update `ShopHeader` Account links to open the widget instead of navigating to `/shop/account`
- Keep the `CustomerAccount` route as a fallback but redirect to `/shop` since account management lives in the widget

## Technical Details

### Files to modify:
1. **`src/components/shop/ShopLayout.tsx`** -- Add `CustomerWidget` import and render it. Optionally remove `StylingChatbot` if the widget replaces it.
2. **`src/components/shop/ShopHeader.tsx`** -- Change the Account link to trigger the widget open instead of navigating to `/shop/account`.
3. **`src/pages/CustomerAccount.tsx`** -- Either redirect to `/shop` or keep as-is but remove from nav. The widget handles all customer auth now.

### What stays the same:
- `AccountTab.tsx` -- Already uses the correct custom JWT system (no changes needed)
- `widget-customer-auth` edge function -- Already handles signup (name + email + password), login, profile, and session validation (no changes needed)
- Merchant auth (`/auth` page, Supabase auth) -- Completely untouched and separate

### Result:
- Customers on the storefront interact only with the widget sidebar for auth (name, email, password via custom JWT)
- Merchants continue using the `/auth` page with Supabase auth
- The two systems never intersect
