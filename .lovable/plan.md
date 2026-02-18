

# Widget Flow Reorder + Virtual Try-On Fix

## Overview
Two changes: (1) reorder the widget tabs so the journey starts with Quiz and flows naturally, and (2) fix the Virtual Try-On to generate AI images of the customer wearing their chosen complete outfit instead of a hardcoded demo product.

---

## 1. Reorder Widget Tab Flow

**Current order:** Outfits > Quiz > Wishlist > Try-On > Account (default: Outfits)

**New order:** Quiz > Outfits > Wishlist > Try-On > Account (default: Quiz)

### Changes:
- **`InlineCustomerWidget.tsx`** and **`CustomerWidget.tsx`**: Change default tab from `"outfits"` to `"quiz"`. Reorder the `TabsTrigger` and `TabsContent` elements to match: Quiz, Outfits, Wishlist, Try-On, Account.
- **`StyleQuizTab.tsx`**: Accept an `onComplete` callback prop. When the quiz is submitted and shows the "You're all set!" screen, include a "View My Outfits" button that calls `onComplete()` to switch to the Outfits tab automatically.
- **`InlineCustomerWidget.tsx`** and **`CustomerWidget.tsx`**: Pass `onComplete={() => setActiveTab("outfits")}` to `StyleQuizTab`.

---

## 2. Fix Virtual Try-On to Use Chosen Outfits

### Problem
The Try-On tab currently uses a hardcoded demo product (a single "Silk Midi Dress" from Unsplash). It doesn't connect to the outfits generated in the Outfits tab, and the AI model name is invalid.

### Solution

**A. Pass selected outfit data to TryOnTab**

- **`TryOnTab.tsx`**: Accept an optional `outfitItems` prop (array of items with name, image URL, category). If provided, show the outfit items instead of the hardcoded product. If no outfit is selected, show a message directing the user to pick an outfit first.
- **`OutfitsTab.tsx`**: Add a "Try On This Look" button to each outfit card. When clicked, it calls a callback like `onSelectOutfitForTryOn(outfit)` which stores the selected outfit and switches to the Try-On tab.
- **`InlineCustomerWidget.tsx`** and **`CustomerWidget.tsx`**: Hold state for `selectedOutfit`, pass it down to `TryOnTab`, and wire up the tab switch.

**B. Fix the edge function**

- **`supabase/functions/virtual-tryon/index.ts`**:
  - Accept `outfitItems` (array of `{name, imageUrl, category}`) instead of a single `productImageUrl`.
  - Update the AI prompt to describe generating the person wearing the **complete outfit** (all items together).
  - Fix the model name from `google/gemini-2.5-flash-image-preview` to `google/gemini-3-pro-image-preview` (valid model for higher quality image generation).
  - Pass all outfit item images as `image_url` entries so the AI sees each piece.

---

## Technical Details

### Files to modify:

1. **`src/components/widget/InlineCustomerWidget.tsx`**
   - Default tab: `"quiz"`
   - Reorder tabs: Quiz, Outfits, Wishlist, Try-On, Account
   - Add `selectedOutfit` state
   - Pass `onComplete` to `StyleQuizTab`
   - Pass `onSelectOutfitForTryOn` to `OutfitsTab`
   - Pass `outfitItems` to `TryOnTab`

2. **`src/components/widget/CustomerWidget.tsx`**
   - Same changes as InlineCustomerWidget (default tab, tab order, state wiring)

3. **`src/components/widget/tabs/StyleQuizTab.tsx`**
   - Add `onComplete?: () => void` prop
   - Add "View My Outfits" button on completion screen that calls `onComplete()`

4. **`src/components/widget/tabs/OutfitsTab.tsx`**
   - Add `onSelectOutfitForTryOn?: (outfit: Outfit) => void` prop
   - Add "Try On This Look" button to each outfit card

5. **`src/components/widget/tabs/TryOnTab.tsx`**
   - Accept `outfitItems?: Array<{name: string, imageUrl: string, category: string}>` prop
   - Replace hardcoded product with outfit items display
   - Show "Select an outfit first" message when no items provided
   - Send all outfit items to the edge function

6. **`supabase/functions/virtual-tryon/index.ts`**
   - Accept `outfitItems` array (with item names, image URLs, categories)
   - Build a prompt describing the complete outfit (e.g., "wearing a Navy Blazer, White Silk Blouse, and Black Tailored Trousers")
   - Include all outfit item images in the AI request
   - Fix model to `google/gemini-3-pro-image-preview`
   - Handle rate limit (429) and credit (402) errors

### User journey after changes:

1. Customer opens widget -- lands on **Quiz** tab
2. Completes quiz -- clicks "View My Outfits" -- auto-switches to **Outfits** tab
3. Browses AI-generated outfits -- clicks "Try On This Look" on one -- switches to **Try-On** tab with that outfit pre-loaded
4. Uploads photo -- AI generates image of them wearing the complete outfit
5. Can also browse **Wishlist** and **Account** tabs at any time

