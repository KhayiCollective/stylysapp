

## Plan: Fix Navigation, Subscription Flow & Signup-to-Billing Pipeline

### Issues Identified

1. **"Back to Home" links go to `/` (landing page) instead of `/dashboard`** — Docs layout and Support page link to `/` which triggers the `AuthRoute` redirect to `/dashboard`, but the user sees the landing page first. Should go directly to `/dashboard` for authenticated users.

2. **Subscription buttons on Settings page don't work** — The `create-checkout` edge function uses Shopify's `appSubscriptionCreate` API, which only works when called from within Shopify's admin context. When a standalone user clicks "Starter" or "Professional" on the Settings page, it fails because the Shopify billing API requires the merchant to approve the charge inside Shopify Admin.

3. **Subscription should be selected at signup** — The user wants a flow where the client picks a plan during signup, enters credit card info, gets a 3-day trial, then proceeds to the dashboard.

---

### Changes

#### 1. Fix "Back to Home" navigation for authenticated users

**Files:** `src/components/docs/DocsLayout.tsx`, `src/pages/Support.tsx`

- Replace the static `<Link to="/">` with a conditional link: if the user is authenticated, link to `/dashboard`; otherwise link to `/`.
- DocsLayout line 54: Change `<Link to="/">` to use `/dashboard` when authenticated.
- Support.tsx line 165: Same change.

#### 2. Add plan selection step to signup flow

**File:** `src/pages/Auth.tsx`

- After successful signup, instead of immediately navigating to `/connect-shopify`, show a **plan selection step** (Starter vs Professional) inline on the Auth page.
- Store the selected plan in state, then navigate to `/connect-shopify?plan=starter` (or `professional`).
- Add a new `AuthView` type: `'select-plan'`.
- After signup succeeds, set view to `'select-plan'` instead of navigating.
- When user picks a plan, navigate to `/connect-shopify?plan={selectedPlan}`.

#### 3. Trigger Shopify billing after store connection

**File:** `src/pages/ShopifyConnect.tsx`

- After successful OAuth callback (line 152-168), check if a `plan` query param was passed.
- If a plan was specified, automatically invoke `create-checkout` with that plan after the connection succeeds.
- The `create-checkout` function creates a Shopify `appSubscriptionCreate` and returns a `confirmationUrl` — redirect the user there to approve the charge (this is how Shopify billing works: merchants must approve in Shopify Admin).
- If billing creation fails (e.g., Shopify credentials issue), fall through to the dashboard with a toast.

#### 4. Update create-checkout to handle the flow

**File:** `supabase/functions/create-checkout/index.ts`

- No changes needed — it already creates the `appSubscriptionCreate` mutation and returns a `confirmationUrl`. The flow is: user approves charge on Shopify → redirected to `returnUrl` (`/settings?billing=success`).
- Update `returnUrl` to `/dashboard?billing=success` instead of `/settings?billing=success` so users land on the dashboard after approving.

#### 5. Handle billing=success on Dashboard

**File:** `src/pages/Dashboard.tsx`

- Check for `?billing=success` query param on load.
- If present, show a success toast ("Subscription activated! Your 3-day trial has started.") and clear the param.

---

### Updated Signup Flow

```text
Sign Up → Select Plan → Connect Shopify → Approve Billing on Shopify → Dashboard
```

1. User fills out signup form (email, password, name, brand)
2. After account creation, shown plan selection (Starter $14.99/mo or Professional $29.99/mo)
3. User picks plan → navigated to Connect Shopify page (plan stored in URL param)
4. User connects Shopify store via OAuth
5. After successful connection, `create-checkout` is called automatically with the selected plan
6. User is redirected to Shopify's billing approval page (3-day free trial)
7. After approval, user lands on `/dashboard?billing=success` with a success message

### Files Modified
- `src/components/docs/DocsLayout.tsx` — Smart "Back" link
- `src/pages/Support.tsx` — Smart "Back" link
- `src/pages/Auth.tsx` — Add plan selection step after signup
- `src/pages/ShopifyConnect.tsx` — Auto-trigger billing after OAuth success
- `supabase/functions/create-checkout/index.ts` — Update returnUrl to `/dashboard`
- `src/pages/Dashboard.tsx` — Handle `billing=success` param

