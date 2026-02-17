
# Show Dashboard Directly When Opened from Shopify Admin

## Problem
When a merchant clicks "STYLYS" in their Shopify Admin sidebar, the app loads at `/` inside an iframe. This shows the marketing landing page with a "Sign In" button, instead of the Dashboard. The `/embedded` route already handles the dashboard view correctly, but it's never reached.

## Solution
Update the `Index` page (the `/` route) to detect when it's running inside the Shopify Admin iframe and automatically redirect to `/embedded` with the shop parameter preserved.

## How it works
- Detect embedded context: the page is in an iframe (`window.self !== window.top`) AND has a `shop` query parameter
- If embedded, redirect to `/embedded?shop=xxx` which already handles shop verification and renders the Dashboard
- If not embedded, show the normal marketing landing page

## Technical Details

**File: `src/pages/Index.tsx`**

Add early detection logic at the top of the component:

```tsx
import { Link, Navigate, useSearchParams } from "react-router-dom";

const Index = () => {
  const [searchParams] = useSearchParams();
  const shop = searchParams.get("shop");
  
  // If running inside Shopify Admin iframe, redirect to embedded dashboard
  const isEmbedded = typeof window !== "undefined" && window.self !== window.top && shop;
  
  if (isEmbedded) {
    return <Navigate to={`/embedded?${searchParams.toString()}`} replace />;
  }
  
  // ... rest of landing page
};
```

This is a minimal change -- the existing `EmbeddedApp` component at `/embedded` already handles shop verification, test mode, and rendering the Dashboard with the `EmbeddedDashboard` layout.
