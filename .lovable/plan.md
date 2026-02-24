

## Problem Analysis

Your profile is linked to the wrong brand. Here's the current state:

```text
Your profile (info@hausofkhayi.com)
  └── points to: cbfe18b2 "STYLYS APP"
       └── domain: test-store.myshopify.com
       └── token: test_mock_... (FAKE — causes all 401 errors)

Actual working brand:
  └── 90729a9c "khayi-collective"
       └── domain: khayi-collective.myshopify.com
       └── token: shpat_4fee... (REAL Shopify token)
```

Every backend function (`shopify-proxy`, `shopify-product-sync`, `check-subscription`, `create-checkout`) looks up your brand via your profile. Since your profile points to `cbfe18b2` with mock credentials, they all get 401 from Shopify.

## Fix (Two Parts)

### 1. Re-point your profile to the real brand

Update your profile's `brand_id` from `cbfe18b2` (mock) to `90729a9c` (real khayi-collective with valid token).

```sql
UPDATE profiles
SET brand_id = '90729a9c-a8b2-4eda-9d82-ddbb970d5565'
WHERE id = '1d43362c-e853-4b45-8769-9467bfb4e2a7';
```

### 2. Clean up the mock brand

Delete the "STYLYS APP" test brand with fake credentials to prevent future fallback issues.

```sql
DELETE FROM brands WHERE id = 'cbfe18b2-b2f2-444f-a6fc-bbf9439c37a7';
```

### Files Modified
- **Database only** — no code changes needed. The edge functions already work correctly; they just need real credentials.

### After Fix
- The `/shop` page will load products from `khayi-collective.myshopify.com`
- Webhook status will show registered webhooks
- Product sync will work
- Subscription/billing flow will use the real Shopify Admin API token

