

# Add Anchor Product Selector to Widget Demo

## What Changes

Replace the static anchor product display with a dropdown selector that lets the merchant pick any product from their synced catalog. When a new anchor is selected, the demo automatically regenerates outfits.

## Technical Details

### File: `src/pages/Rules.tsx`

**Anchor product section (lines 416-427):**
- Add a `Select` dropdown (from `@radix-ui/react-select`, already in the project) next to the anchor product thumbnail
- The dropdown lists all `demoProducts` by name, with the current anchor pre-selected
- On change, update `demoAnchor` state -- the existing `useEffect` on `demoAnchor` already triggers `generateDemoOutfits` automatically

**Layout:**
- Keep the compact horizontal card layout
- Add the `Select` component inline after the product name/price, or replace the static text section with a select + thumbnail combo
- The thumbnail updates to show the newly selected product's image

**Imports:**
- Add `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` from `@/components/ui/select`

**No new state needed** -- `demoAnchor` and `demoProducts` already exist. Just wire the Select's `onValueChange` to find the matching product and call `setDemoAnchor`.

