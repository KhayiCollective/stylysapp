

# Tier-Based Feature Gating, AI Chatbot, and Landing Page Updates

## Overview

This plan adds three things:

1. **Product limits per tier** -- Starter gets 500 products, Professional gets 1,000
2. **AI Styling Chatbot gated to Professional tier** -- both in the merchant dashboard and the storefront widget
3. **Priority support for Professional accounts** -- live chat AI support in-dashboard, plus priority badge on support tickets
4. **Landing page updates** -- feature Virtual Try-On and AI Outfit Builder as headline capabilities with differentiated tier features

---

## 1. Tier Configuration Update

Update `src/lib/tiers.ts` to include feature limits per tier:

```text
TIERS = {
  starter: {
    priceId, productId, name, price,
    maxProducts: 500,
    features: ["ai_outfits", "virtual_tryon", "basic_analytics"]
  },
  professional: {
    priceId, productId, name, price,
    maxProducts: 1000,
    features: ["ai_outfits", "virtual_tryon", "styling_chatbot", "priority_support", "full_analytics", "customer_tracking"]
  }
}
```

Add a helper: `getTierLimits(tierName)` that returns `{ maxProducts, features }`.

---

## 2. Product Limit Enforcement

### Frontend (Catalog page)
- Use `useSubscription` to get the current tier
- Show a product count indicator: "245 / 500 products used"
- Disable the "Add Product" button and show an upgrade prompt when the limit is reached
- Block the Import Products dialog when at capacity

### Backend (sync edge functions)
- In `shopify-product-sync` and `woocommerce-product-sync`, query the current product count before inserting
- If adding products would exceed the tier limit, return an error with a clear message
- This requires the sync functions to know the tier, which can be done by looking up the brand owner's email in Stripe (same pattern as `check-subscription`)

---

## 3. AI Styling Chatbot -- Professional Only

### Dashboard Chatbot
- Add a `StylingChatbot` component to the dashboard layout (already exists in `src/components/shop/StylingChatbot.tsx`)
- Gate it behind `useSubscription`: only render the floating chat button if `tierName === "professional"`
- For Starter users, show a teaser button that opens an upgrade prompt instead

### Widget Chatbot (storefront)
- The widget already has the `styling-chat` edge function
- Add a "Chat" tab to the `InlineCustomerWidget` that uses the same streaming chatbot
- The widget-loader or widget edge function should check the brand's subscription tier and only include the chat tab if the brand is on Professional

---

## 4. Priority Support System for Professional

### Support Ticket Enhancement
- Add a `priority` column to the `support_tickets` table (values: "standard", "priority")
- When a Professional user submits a ticket, auto-set priority to "priority"

### In-Dashboard Support Chat
- For Professional merchants, add an AI-powered support chatbot accessible from the dashboard sidebar or Settings page
- This uses the existing `styling-chat` edge function pattern but with a support-focused system prompt
- Create a new `support-chat` edge function with a system prompt focused on STYLYS platform help, billing questions, and technical troubleshooting

---

## 5. Landing Page Updates

### Features Section Redesign
Update the 4 feature cards to highlight the core product capabilities:

1. **AI Outfit Builder** -- "Our AI creates personalized outfit combinations from your catalog, increasing average order value by 35%"
2. **Virtual Try-On** -- "Customers can see themselves wearing outfits before buying, reducing returns by up to 40%"
3. **AI Styling Chatbot** (Pro) -- "A personal styling assistant that helps customers find the perfect look"
4. **Smart Analytics** -- "Track outfit performance, customer preferences, and conversion rates"

### Pricing Cards Update
Differentiate features clearly between tiers:

**Starter ($14.99/mo):**
- Up to 500 products
- AI outfit recommendations
- Virtual try-on
- Basic analytics
- Shopify and WooCommerce integration
- Email support

**Professional ($29.99/mo):**
- Up to 1,000 products
- Advanced AI outfit generation
- Virtual try-on
- AI styling chatbot
- Full analytics and insights
- Customer preference tracking
- Priority support with live chat
- Shopify and WooCommerce integration

**Enterprise (Custom):**
- Unlimited products
- All Professional features
- Custom AI training
- White-label options
- Dedicated account manager
- 24/7 premium support

---

## Technical Details

### Files to Create
- `supabase/functions/support-chat/index.ts` -- AI support chatbot for Professional merchants

### Files to Modify
- `src/lib/tiers.ts` -- add maxProducts and features arrays
- `src/hooks/useSubscription.ts` -- expose tier limits via helper
- `src/pages/Catalog.tsx` -- add product count vs limit indicator and gate adding
- `src/pages/Index.tsx` -- update features section and pricing card details
- `src/components/layout/DashboardLayout.tsx` -- conditionally render styling chatbot for Pro users
- `src/components/widget/InlineCustomerWidget.tsx` -- add Chat tab gated by brand tier
- `src/pages/Support.tsx` -- add live chat option for Pro users
- `src/pages/Settings.tsx` -- show tier features summary in billing section
- `supabase/config.toml` -- add support-chat function config

### Database Migration
- Add `priority` column to `support_tickets` table (default: "standard")

### No New Secrets Required
- All edge functions use existing `LOVABLE_API_KEY` and `STRIPE_SECRET_KEY`

