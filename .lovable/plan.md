

# Reorder Widget Flow + Smarter Virtual Try-On

## Overview
Three changes: (1) move Account to be the first tab so customers sign in/up before anything else, (2) remove the email step from the quiz since the account already captures it, and (3) make the virtual try-on prompt smarter about focusing on the actual product being sold rather than the full styling shown in a product image.

---

## 1. New Tab Order: Account First

**Current:** Quiz > Outfits > Wishlist > Try-On > Account

**New:** Account > Quiz > Outfits > Wishlist > Try-On

The customer signs in or creates an account first, then takes the quiz, browses outfits, and tries them on.

### Files:
- **`InlineCustomerWidget.tsx`**: Change default tab to `"account"`, reorder TabsTriggers and TabsContents
- **`CustomerWidget.tsx`**: Same reorder

---

## 2. Remove Email Step from Quiz

The quiz currently has 5 steps starting with an email collection step (step 0). Since the customer already has an account with their email, this step is unnecessary.

### File: `StyleQuizTab.tsx`
- Remove step 0 (email input)
- Reduce `totalSteps` from 5 to 4
- Shift all remaining steps down (Style becomes step 0, Colors step 1, Body Shape step 2, Occasions step 3)
- Remove the `email` state variable and the `disabled={step === 0 && !email}` check on Next button
- Remove `email` from the submit log

---

## 3. Smarter Virtual Try-On Prompting

Currently the AI prompt treats all outfit items equally. The user wants the try-on to be aware that a product image might show a full look (top + bottom) but only one piece is the actual product for sale.

### File: `supabase/functions/virtual-tryon/index.ts`
- Update the prompt to instruct the AI to focus on each item's **category** label to understand what specific garment piece to use from each product image
- For example: "The product image for 'Classic Denim Jeans' (category: bottoms) may show a model wearing a top and bottom -- only use the **bottoms** from this image"
- The prompt will iterate through items and explicitly call out: "From the image of [name], use only the [category] piece"

### File: `OutfitsTab.tsx`
- No changes needed -- it already passes `category` per item

---

## Technical Details

### `InlineCustomerWidget.tsx` and `CustomerWidget.tsx`
- Default tab: `"account"`
- Tab order: Account, Quiz, Outfits, Wishlist, Try-On
- After account login/signup, the AccountTab could offer a "Take Style Quiz" button (already has a "Complete Your Profile" prompt that links to style preferences -- we can add a callback to switch to the Quiz tab)

### `StyleQuizTab.tsx`
- Remove step 0 (email), remove `email` state
- Steps become: 0=Style, 1=Colors, 2=Body Shape, 3=Occasions
- `totalSteps = 4`
- Next button always enabled on step 0 (no email check)

### `supabase/functions/virtual-tryon/index.ts`
- Enhanced prompt with per-item instructions like:
  ```
  For each product image provided:
  - "[Item Name]" (category: [category]) -- extract ONLY the [category] garment from this image, ignore other clothing shown
  ```
- This tells the AI that if a "Tailored Trousers" image shows a model in a blazer and trousers, it should only use the trousers

### `AccountTab.tsx`
- Add an `onNavigateToQuiz` callback prop
- On the logged-in home view, the "Complete Your Profile" section gets a button that calls `onNavigateToQuiz()` to switch to the Quiz tab

