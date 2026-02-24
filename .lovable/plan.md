

## Analysis

After reviewing all the widget tab components and the backend functions, here are the five issues found:

### 1. Customer session expires after 1 hour
The JWT in `widget-customer-auth/index.ts` line 28 sets `exp: getNumericDate(60 * 60)` — only 1 hour. Customers get logged out quickly.

### 2. Photo upload only exists in Try-On tab
The customer photo upload is buried in the Try-On tab. It should also be accessible from the Account tab so customers can save their photo to their profile independently of try-on.

### 3. Customer photo not used during outfit generation
The `widget-outfits/generate` endpoint doesn't receive or use the customer's style profile (preferences, sizing, body shape) when generating outfits. It only uses the product catalog.

### 4. Style Quiz is identical to Account style preferences
`StyleQuizTab.tsx` asks the exact same questions (style, colors, body shape, occasions) as the Account > Style Preferences sub-view. The quiz should ask **different**, session-specific questions (occasion for today, color mood, formality level, budget) while the Account tab keeps the persistent profile preferences.

### 5. Quiz results not saved or used
The quiz's `handleSubmit` only logs to console — it doesn't save answers to the backend or pass them to outfit generation.

---

## Plan

### A. Extend JWT expiry to 30 days
**File:** `supabase/functions/widget-customer-auth/index.ts`
- Change `exp: getNumericDate(60 * 60)` → `exp: getNumericDate(30 * 24 * 60 * 60)` (30 days)
- This keeps customers logged in across sessions

### B. Add photo upload to Account tab
**File:** `src/components/widget/tabs/AccountTab.tsx`
- Add a photo upload section in the logged-in home view (next to the user avatar area)
- When uploaded, call the existing `widget-customer-auth/photo` endpoint
- Display the saved photo as the user's avatar instead of the generic icon

### C. Redesign Style Quiz with different questions
**File:** `src/components/widget/tabs/StyleQuizTab.tsx`
- Remove the duplicate style/colors/body-shape/occasions questions
- Replace with session-specific outfit discovery questions:
  - **Step 1:** "What's the occasion?" (e.g., Work Meeting, Brunch, Date Night, Everyday, Special Event, Travel)
  - **Step 2:** "What color mood are you feeling?" (Neutral & Earthy, Bold & Bright, Monochrome, Pastels, Dark & Moody)
  - **Step 3:** "How dressed up?" (Casual, Smart Casual, Dressy, Formal) + comfort level slider
  - **Step 4:** "Budget for this outfit?" (Under $100, $100-$250, $250-$500, No limit)
- On submit, save quiz answers to the backend via `widget-customer-auth/profile` (as `quiz_answers` or similar) AND pass them directly to the Outfits tab

### D. Pass customer profile + quiz answers into outfit generation
**Files:** `src/components/widget/tabs/OutfitsTab.tsx`, `supabase/functions/widget-outfits/index.ts`
- OutfitsTab: read customer token, fetch profile (or receive quiz answers from parent), send `style_preferences`, `body_shape`, `size_info`, `occasions`, and quiz session answers in the generate request
- `widget-outfits/generate`: accept optional `customer_profile` and `quiz_session` in request body, inject them into the AI prompt so outfits are personalized to the customer's sizing, style, and current occasion/mood

### E. Wire photo + quiz flow through parent widget
**Files:** `InlineCustomerWidget.tsx`, `CustomerWidget.tsx`
- Pass quiz answers state from quiz tab → outfits tab so generation uses them
- Pass the customer photo URL to the outfits tab header (cosmetic, shows who the outfits are for)
- When quiz completes, auto-navigate to outfits tab with the quiz session data

### Files Modified
- `supabase/functions/widget-customer-auth/index.ts` — longer JWT expiry
- `supabase/functions/widget-outfits/index.ts` — accept customer profile + quiz data in prompt
- `src/components/widget/tabs/AccountTab.tsx` — add photo upload section
- `src/components/widget/tabs/StyleQuizTab.tsx` — completely different questions
- `src/components/widget/tabs/OutfitsTab.tsx` — pass profile data to generate call
- `src/components/widget/InlineCustomerWidget.tsx` — wire quiz answers state
- `src/components/widget/CustomerWidget.tsx` — wire quiz answers state

