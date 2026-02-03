

# Plan: Enable Access to Settings Page for Developer Test Mode

## Problem
You're caught in a redirect loop: the Settings page (which contains Developer Test Mode) requires Shopify to be connected, but you need Developer Test Mode to create a mock connection when you can't complete real OAuth.

## Solution
Modify the Settings route to bypass the Shopify requirement, allowing you to access the Developer Test Mode and create a mock connection.

## Implementation Steps

### Step 1: Update Settings Route in App.tsx
Change the Settings route from:
```tsx
<Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
```
To:
```tsx
<Route path="/settings" element={<ProtectedRoute requireShopify={false}><Settings /></ProtectedRoute>} />
```

This allows authenticated users to access Settings even without a Shopify connection.

### Step 2: Add Direct Link to Settings from Connect Page
Add a link on the `/connect-shopify` page pointing to the Settings page so users can easily access Developer Test Mode.

---

## Technical Details

**File Changes:**
| File | Change |
|------|--------|
| `src/App.tsx` | Add `requireShopify={false}` to Settings route |
| `src/pages/ShopifyConnect.tsx` | Add link to Settings/Developer Test Mode |

**Routes affected:**
- `/settings` - Will become accessible without Shopify connection

## Testing After Implementation
1. Navigate to `/settings`
2. Scroll to "Developer Test Mode" section
3. Toggle Test Mode ON
4. Click "Run Integration Tests" to verify edge function health
5. Enter your dev store name (e.g., `your-dev-store`)
6. Click "Create Mock Connection"
7. Navigate to Dashboard to verify mock connection works

