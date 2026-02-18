
# Fix: Widget Preview Shows Wrong Content in Shopify Iframe

## Problem
When customers click the STYLYS widget button on the Shopify store, the widget-loader opens a sidebar iframe pointing to `/widget-preview`. That page currently renders:
1. A full mock store page (header with "Back to Dashboard" link, product image, description)
2. A `CustomerWidget` component that starts **closed** and requires another click
3. The CustomerWidget opens as a nested Sheet (slide-in panel) inside the already-narrow iframe

This broken flow means customers either see the demo store mockup or accidentally navigate to merchant pages (like "Connect Shopify") via the "Back to Dashboard" link.

## Solution
Rewrite the `WidgetPreview` page to render the customer widget tabs **directly** (inline) when loaded inside an iframe, without any Sheet wrapper, mock store chrome, or merchant links.

## Technical Changes

### 1. Create an inline widget component (`src/components/widget/InlineCustomerWidget.tsx`)
- Renders the same tabs (Outfits, Quiz, Wishlist, Try-On, Account) directly in the page
- No Sheet wrapper, no floating button — just the header + tabs + content filling the full height
- Same STYLYS branded header with close button (posts a message to parent to close the panel)
- Accepts `brandId` prop for customer auth

### 2. Update `src/pages/WidgetPreview.tsx`
- Detect if loaded inside an iframe (`window.self !== window.top`)
- If in iframe: render `InlineCustomerWidget` full-screen (no mock store page)
- If standalone (merchant preview): keep current mock store layout with the Sheet-based `CustomerWidget`
- Remove the "Back to Dashboard" link when in iframe mode

### 3. Add parent communication
- The inline widget's close (X) button will use `window.parent.postMessage` to tell the widget-loader to close the panel
- Update `widget-loader/index.ts` to listen for this close message

### Result
- Customers on Shopify store click the widget button and immediately see the tabbed widget (Outfits, Quiz, Wishlist, Try-On, Account)
- Account tab shows the customer-only signup/login (Name, Email, Password via custom JWT)
- No merchant content (Connect Shopify, Dashboard links) is ever visible to customers
- Merchant preview mode (standalone `/widget-preview`) continues to work as before
