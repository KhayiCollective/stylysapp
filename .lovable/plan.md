

# Widget Demo: Smaller Anchor Image + Editorial Outfit Cards

## Changes

### 1. Shrink the Anchor Product Image
The current anchor product takes up a full `aspect-[3/4]` half of the grid, which is oversized for a preview context. Replace the large hero image with a compact horizontal layout: a smaller thumbnail alongside product details, all in one row.

### 2. Redesign Outfit Cards to Be More Editorial
Replace the current boxy list of outfits with a magazine-style editorial layout:
- Each outfit gets a horizontal card with overlapping/staggered product images (editorial collage feel)
- Outfit name displayed in a refined serif/display font style with a subtle occasion tag
- Product thumbnails shown in a tighter filmstrip row with minimal spacing
- Selected outfit uses a subtle highlight border instead of the heavy checked-circle treatment
- Pricing shown in a more understated way

### File: `src/pages/Rules.tsx` (lines ~397-527)

**Anchor section (lines 416-425):**
- Replace `aspect-[3/4]` full-column image with a compact row: small `w-24 h-32` thumbnail + text beside it
- Remove the separate column layout -- anchor + outfits card stack vertically instead of side-by-side grid

**Outfit cards (lines 462-497):**
- Change product image layout from equal `flex-1` squares to a horizontal filmstrip with `w-16 h-20` thumbnails using `aspect-[3/4]` ratio and `-ml-2` overlap for editorial collage effect
- Style outfit name with `font-display tracking-wide uppercase text-xs` for editorial feel
- Move price to a subtle right-aligned position
- Add a thin left border accent on the selected outfit instead of the full border + checkmark

**Selected outfit footer (lines 501-514):**
- Keep the total and CTA but style more minimally -- smaller font, understated button

### Technical Details

All changes are in a single file (`src/pages/Rules.tsx`), purely CSS/layout adjustments. No logic or data changes needed.

- Anchor section: switch from `grid lg:grid-cols-2` to a single column with a compact inline anchor card
- Outfit items: overlapping thumbnails via negative margin, smaller image sizing
- Typography: leverage existing `font-display` class with tighter tracking for editorial headers
- Spacing: reduce padding in outfit cards from `p-4` to `p-3` for a tighter, magazine-like density

