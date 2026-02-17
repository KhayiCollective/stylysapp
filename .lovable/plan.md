

# Fix: Widget Scope Error Not Detected Properly

## Problem
When you click "Enable Widget", the edge function correctly returns `{ error: "scope_error" }` with a 403 status, but the frontend code in `WidgetStatus.tsx` never reads that response. It throws on the generic error object first, then the catch block fails to match "scope" in the error message, so you see the unhelpful "Failed to toggle widget" toast instead of the re-authorization prompt.

## Fix (1 file change)

### `src/components/settings/WidgetStatus.tsx` - Fix error handling order

Rewrite the `handleToggle` try block so that when `supabase.functions.invoke` returns both `error` and `data`, we check `data` for `scope_error` **before** throwing:

```typescript
const { data, error } = await supabase.functions.invoke('shopify-widget-toggle', {
  body: { brand_id: brandData.id, action: isWidgetActive ? 'remove' : 'install' },
});

// Check for scope error in response data FIRST (edge function returns data even on 403)
if (data?.error === 'scope_error') {
  setScopeError(true);
  return;
}

// Then handle other errors
if (error) throw error;
```

This ensures the scope error alert with the "Re-authorize" button appears correctly, guiding you to refresh the Shopify permissions.

No other files need changes -- the edge function already returns the right response, it's just the frontend not reading it properly.

