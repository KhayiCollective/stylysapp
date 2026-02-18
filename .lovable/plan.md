

# Implement Pricing Tiers with 3-Day Free Trial

## Overview

Wire up Stripe subscriptions for STYLYS's three pricing tiers (Starter $14.99/mo, Professional $29.99/mo, Enterprise custom) with a 3-day free trial that auto-converts to paid.

## Step 1: Create Stripe Products and Prices

Use Stripe tools to create two products with monthly recurring prices:
- **Starter** -- $14.99/month
- **Professional** -- $29.99/month
- Enterprise stays as "Contact Sales" (no Stripe product needed)

## Step 2: Create Edge Functions

### `create-checkout` 
- Accepts a `priceId` from the frontend
- Looks up or creates a Stripe customer by user email
- Creates a Stripe Checkout session with `mode: "subscription"` and `subscription_data.trial_period_days: 3`
- Returns the checkout URL

### `check-subscription`
- Looks up Stripe customer by email
- Checks for active or trialing subscriptions
- Returns `{ subscribed, productId, trialEnd, subscriptionEnd }`

### `customer-portal`
- Creates a Stripe Customer Portal session for managing/canceling subscriptions
- Returns the portal URL

## Step 3: Subscription State Hook

Create `src/hooks/useSubscription.ts`:
- Calls `check-subscription` on mount and periodically
- Exposes `{ subscribed, loading, productId, trialEnd, isTrialing, checkSubscription }`
- Maps Stripe product IDs to tier names (Starter/Professional)

## Step 4: Update the Landing Page Pricing Cards

Wire the "Start Free Trial" buttons on `Index.tsx` to navigate to `/auth` with a `?plan=starter` or `?plan=pro` query param so after signup, the user is redirected to Stripe Checkout for that plan.

## Step 5: Post-Signup Checkout Flow

In `Auth.tsx`, after successful signup:
1. Run account bootstrap
2. Check if a `plan` query param exists
3. If yes, invoke `create-checkout` with the matching price ID and redirect to Stripe

## Step 6: Subscription Management in Settings

Add a "Billing" section to `Settings.tsx`:
- Show current plan, trial status, and renewal date via `useSubscription`
- "Manage Subscription" button that opens the Stripe Customer Portal
- If not subscribed, show upgrade buttons

## Step 7: Gate Features (Optional)

Use `useSubscription` in `ProtectedRoute` or individual pages to show upgrade prompts for unsubscribed users.

---

## Technical Details

### Tier Mapping Constant
```text
TIERS = {
  starter:      { priceId: "price_xxx", productId: "prod_xxx", name: "Starter",      price: "$14.99" },
  professional: { priceId: "price_yyy", productId: "prod_yyy", name: "Professional", price: "$29.99" },
}
```

### Files Created
- `supabase/functions/create-checkout/index.ts`
- `supabase/functions/check-subscription/index.ts`
- `supabase/functions/customer-portal/index.ts`
- `src/hooks/useSubscription.ts`
- `src/lib/tiers.ts` (tier mapping constants)

### Files Modified
- `src/pages/Index.tsx` -- wire pricing buttons with plan param
- `src/pages/Auth.tsx` -- post-signup checkout redirect
- `src/pages/Settings.tsx` -- add billing section
- `src/App.tsx` -- add success/cancel routes if needed
- `supabase/config.toml` -- add `verify_jwt = false` for new functions

### Trial Behavior
- Stripe handles the 3-day trial natively via `trial_period_days: 3`
- During trial, `check-subscription` returns `isTrialing: true`
- After 3 days, Stripe auto-charges the card on file (card is collected at checkout)
- No custom database tables needed -- Stripe is the source of truth

