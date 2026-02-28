

## Plan: Update Privacy Policy for Shopify Data Protection Compliance

### Shopify Form Verification

Your selections are **all correct**:
- **Customer service** — support tickets and support chat handle customer questions
- **Store management** — correctly unchecked; the app only reads products, doesn't manage orders/labels/inventory
- **App functionality** — customer account auth (email/password via widget), merchant billing
- **Analytics** — sync history, recommendation tracking, widget metrics
- **Personalization** — style quiz, AI outfit recommendations, saved outfits
- **Marketing or advertising** — correctly unchecked; no marketing emails or cart recovery sent
- **Other** — not needed

### Privacy Policy Changes

**File: `src/pages/Privacy.tsx`**

1. Update "Last updated" date to February 28, 2026
2. **Section 1** — Add data processor role: "For store customer data, we act as a data processor on behalf of merchants (data controllers)."
3. **Section 2.2** — Add "Email address (voluntarily provided when creating a widget account)" and "Name (optional, self-reported)"; add clarification: "We do not access Shopify customer records directly. All customer data is collected through our widget interface."
4. **Section 3** — Restructure to map to the 4 Shopify-approved reasons:
   - Customer service: respond to support inquiries
   - App functionality: authenticate widget accounts, process subscriptions
   - Analytics: measure recommendation performance, sync metrics
   - Personalization: generate outfit recommendations based on style preferences
   - Add explicit statement: "We do not use customer data for marketing or advertising purposes."
5. **Section 5 (Data Security)** — Expand with specifics: TLS 1.2+ in transit, AES-256 at rest, row-level security for multi-tenant isolation, masked database views preventing bulk data exposure, bcrypt password hashing, access logging via backend function invocations
6. **Section 6 (Data Retention)** — Add: data deleted upon app uninstall (via shop/redact webhook), customer data deleted upon customers/redact request
7. **New Section 10: "Shopify Compliance"** (before Cookies, renumber remaining):
   - We comply with Shopify's mandatory data protection requirements
   - We handle `customers/data_request`, `customers/redact`, and `shop/redact` webhooks
   - Data requests responded to within 30 days
   - Upon app uninstall, all merchant and customer data is purged
8. **New Section 11: "No Sale of Personal Information"** — Standalone explicit statement that we never sell, rent, or trade personal information
9. **Section 7 (Your Rights)** — Add "Do Not Sell My Information" right
10. Renumber all subsequent sections accordingly (final section count goes from 13 to 16)

### No backend changes needed
The compliance webhook handlers are already fully implemented in `shopify-webhooks/index.ts`.

