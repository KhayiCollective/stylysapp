

## Plan: Restrict AI Chatbot to Professional Subscription

### Changes

**1. Frontend: `src/components/shop/StylingChatbot.tsx`**
- Accept new props: `isProfessional: boolean` and `subscriptionLoading: boolean`
- When `isProfessional` is false, render the chatbot FAB as usual but when opened, show a locked state instead of the chat interface
- Locked state: lock icon, message "AI Chatbot is available on the Professional plan. Upgrade to unlock advanced AI features.", and an "Upgrade Plan" button linking to `/settings` (billing section)
- When `subscriptionLoading` is true, show a loading spinner in the sheet

**2. Frontend: `src/components/shop/ShopLayout.tsx`**
- Import `useSubscription` and `hasFeature`
- Pass `isProfessional={hasFeature(tierName, 'styling_chatbot')}` and `subscriptionLoading` to `StylingChatbot`

**3. Backend: `supabase/functions/styling-chat/index.ts`**
- Add subscription validation at the top of the handler
- Extract the auth token from the `Authorization` header
- Look up the user's brand, then query Shopify for active subscriptions (same pattern as `check-subscription`)
- If no active Professional subscription, return 403 with `{ error: "AI Chatbot requires a Professional plan." }`
- This ensures even direct API calls are blocked for non-Professional users

### Technical notes
- The tier system already defines `styling_chatbot` as a Professional-only feature in `src/lib/tiers.ts`
- The `check-subscription` edge function already implements the Shopify subscription query pattern that `styling-chat` will reuse
- The upgrade CTA links to `/settings` which contains the billing/plan section

