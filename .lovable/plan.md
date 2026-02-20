

# Secure Developer-Only Routes and Clean Up Merchant Experience

## What's Already Working
- Developer sections on the Settings page (Test Mode, Setup Guide link, Webhook Status, Sync History) are correctly hidden from merchants via `isDevUser` role check
- Merchants have a clean, simple connection flow at `/connect-shopify`

## What Needs Fixing

### 1. Protect the `/shopify-setup` route by role
The Shopify Setup Guide page is accessible to any logged-in user who navigates to `/shopify-setup` directly. This page contains developer-only content (Partner accounts, OAuth credentials, API scopes). It should redirect non-developer users away.

**File: `src/pages/ShopifySetupGuide.tsx`**
- Add `useUserRole()` hook check at the top of the component
- If the user is not a dev user (`!isDevUser`), redirect them to `/settings` or `/dashboard`
- Show a loading state while the role is being checked

### 2. No other changes needed
- The `ShopifyConnection` component (visible to all users) already provides a clean "Connect Shopify Store" button that sends merchants to `/connect-shopify`
- The `/connect-shopify` page is merchant-friendly — it asks for the store name and handles OAuth automatically
- Developer Test Mode, Webhook Status, and Sync History are all properly hidden behind `isDevUser`

## Technical Details

```text
ShopifySetupGuide.tsx changes:
+  import { useUserRole } from '@/hooks/useUserRole';
+  import { Navigate } from 'react-router-dom';
+
+  const { isDevUser, loading: roleLoading } = useUserRole();
+
+  if (roleLoading) return loading spinner
+  if (!isDevUser) return <Navigate to="/settings" replace />
```

### Files to modify
- `src/pages/ShopifySetupGuide.tsx` — add role-based access guard

