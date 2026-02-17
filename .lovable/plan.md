

# Hide Developer Sections from Regular Merchants

## Summary
Use the existing role system to conditionally show developer-only sections on the Settings page. Only users with the `owner` or `admin` role will see the technical/developer sections. Regular merchants (with `member` role) will see a cleaner Settings page.

## What changes

### 1. Create a `useUserRole` hook (`src/hooks/useUserRole.ts`)
- Queries the `user_roles` table for the current user
- Returns the user's role (`owner`, `admin`, or `member`) and a loading state
- This hook can be reused elsewhere in the app

### 2. Update Settings page (`src/pages/Settings.tsx`)
- Import and use the new `useUserRole` hook
- Wrap these sections in a conditional that checks for `owner` or `admin` role:
  - **Webhook Status** (WebhookStatusIndicator)
  - **Sync History** (SyncHistoryLog)
  - **Shopify Setup Guide** link
  - **Developer Test Mode** (ShopifyTestMode)
- These sections will simply not render for `member` role users

### What stays visible to all merchants
- Profile settings
- Brand details
- Shopify Connection status
- Widget Status
- Product Sync Status
- Sign Out button

## Technical details

The `useUserRole` hook will query:
```typescript
const { data } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id)
  .single();
```

The RLS policy `Users can view their own roles` already exists, so this query is secure. The Settings page will then use:
```typescript
const isDevUser = role === 'owner' || role === 'admin';
```

Since the `handle_new_user` trigger assigns `owner` to every new signup (i.e., you as the developer), and future client merchants would be given `member` roles, this naturally separates the two audiences.

