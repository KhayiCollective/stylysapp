

## Problem

The `create-checkout` edge function calls `appSubscriptionCreate` via Shopify's Admin API, but the app is flagged as a **Managed Pricing** app by Shopify. This means Shopify rejects the Billing API call entirely.

**Impact:** Both "Starter — $14.99/mo" and "Professional — $29.99/mo" buttons on the Settings page, and the auto-checkout trigger during onboarding, all fail silently or show an error.

## Working CTAs
- **check-subscription**: Correctly queries `currentAppInstallation.activeSubscriptions` — this read-only query still works fine.
- **customer-portal**: Returns the Shopify admin billing URL — works correctly.
- **Manage Subscription** button: Works (opens Shopify admin billing page).

## Broken CTAs
- **Starter $14.99/mo** button on Settings page
- **Professional $29.99/mo** button on Settings page  
- **Auto-checkout** trigger after Shopify OAuth connect (in `ShopifyConnect.tsx`)

## Fix: Switch to Managed Pricing Flow

Since Shopify manages pricing for this app, the checkout flow should redirect merchants to the **Shopify app listing page** where Shopify handles plan selection and billing natively.

### Changes

1. **`supabase/functions/create-checkout/index.ts`** — Instead of calling `appSubscriptionCreate`, return the app listing URL where Shopify handles billing:
   - Return URL format: `https://{store_domain}/admin/charges/{app_handle}/pricing_plans`
   - Or fallback: redirect to the Shopify app's listing page in the App Store

2. **`src/pages/Settings.tsx`** — Update the Starter/Professional buttons to either:
   - Open the Shopify-managed pricing page in a new tab
   - Or show a message explaining that billing is managed through Shopify

3. **`src/pages/ShopifyConnect.tsx`** — Remove the automatic `create-checkout` call after OAuth, since Shopify handles plan activation during app installation for Managed Pricing apps.

### Technical Detail

For Managed Pricing apps, the flow is:
1. Merchant installs app from Shopify App Store → Shopify shows pricing plans
2. Merchant picks a plan → Shopify activates the subscription
3. `check-subscription` (reading `activeSubscriptions`) continues to work as-is to verify status

The `create-checkout` function becomes a redirect helper rather than a Billing API caller.

