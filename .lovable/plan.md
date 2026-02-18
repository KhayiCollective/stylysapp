

# Speed Up Virtual Try-On + Outfit Composition Rules

## Overview
Three changes: (1) speed up the virtual try-on by using a faster AI model, (2) make the outfit generator include shoes/accessories when the catalog has them, and (3) add configurable "Outfit Composition" rules on the merchant Rules page that control how many items and which categories to include -- persisted to the database.

---

## 1. Speed Up Virtual Try-On

**Problem:** Currently uses `google/gemini-3-pro-image-preview` which is the highest-quality (and slowest) image model.

**Solution:** Switch to `google/gemini-2.5-flash-image` (also known as "Nano banana") which is optimized for fast image generation. This trades a small amount of quality for significantly faster response times.

### File: `supabase/functions/virtual-tryon/index.ts`
- Change model from `google/gemini-3-pro-image-preview` to `google/gemini-2.5-flash-image`
- Simplify the prompt slightly to reduce token processing time (shorter = faster)

---

## 2. Outfit Generator: Include Shoes and Accessories

**Problem:** The AI prompt says "typically a top, bottom, and optional accessories/layers" but doesn't strongly encourage including shoes, bags, sunglasses, hats, etc.

**Solution:** Update the `generate-outfits` edge function to:
- Accept an optional `rules` parameter (outfit composition settings from the merchant)
- Use those rules in the AI prompt to specify exactly which categories to include and how many items per outfit
- Default behavior: include accessories/shoes if available in the catalog

### File: `supabase/functions/generate-outfits/index.ts`
- Add `rules` to the request interface: `{ minItems?: number, maxItems?: number, requiredCategories?: string[], optionalCategories?: string[] }`
- Update the system prompt to instruct the AI to include shoes and accessories when available
- Pass the rules into the prompt so the AI knows how many items and which categories the merchant wants

---

## 3. Merchant Rules Page: Outfit Composition Settings

**Problem:** The Rules page uses hardcoded local state and doesn't persist to the `rules` database table. There's no way for merchants to control outfit composition (item count, categories).

**Solution:** 
- Wire the Rules page to the `rules` database table (read on load, update on toggle)
- Add a new "Outfit Composition" section with configurable settings:
  - **Min/Max items per outfit** (slider or number input, e.g. 2-6)
  - **Required categories** (multi-select: tops, bottoms, etc. -- always included)
  - **Optional categories** (multi-select: shoes, bags, sunglasses, hats, jewelry -- included when available)
- Store these as a new rule row in the `rules` table with `category: "composition"` and `config` JSONB holding the settings
- The Outfit Generator and Widget pages read these rules before calling `generate-outfits` and pass them along

### Files:

**`src/pages/Rules.tsx`**
- Fetch rules from the `rules` DB table on mount instead of using hardcoded `initialRules`
- Save toggle changes to the DB via `supabase.from("rules").update()`
- Add a new "Outfit Composition" section with:
  - Min items slider (default: 3)
  - Max items slider (default: 5)
  - Required categories checkboxes (default: tops, bottoms)
  - Optional categories checkboxes (default: shoes, bags, accessories, hats, sunglasses, jewelry)
- On change, upsert to `rules` table with `name: "Outfit Composition"`, `category: "composition"`, `config: { minItems, maxItems, requiredCategories, optionalCategories }`

**`src/pages/OutfitGenerator.tsx`**
- Before calling `generate-outfits`, fetch the composition rule from the `rules` table
- Pass `rules` config in the request body to the edge function

**`src/components/widget/tabs/OutfitsTab.tsx`**
- Same: fetch composition rules for the brand and pass to the edge function

**`src/pages/Widget.tsx`**
- Same: pass rules to edge function

---

## Technical Details

### Database
- No schema changes needed -- the existing `rules` table already has `config: jsonb` and `category: text` columns
- A seed rule for "Outfit Composition" is already created by `handle_new_user()` as "Category Balance" -- we'll add a new composition-specific rule via migration (INSERT into rules for existing brands)

### New rule row structure:
```text
name: "Outfit Composition"
category: "composition"  
config: {
  "minItems": 3,
  "maxItems": 5,
  "requiredCategories": ["tops", "bottoms"],
  "optionalCategories": ["shoes", "bags", "accessories", "hats", "sunglasses", "jewelry"]
}
enabled: true
```

### Migration needed:
- INSERT a default "Outfit Composition" rule for all existing brands that don't have one yet

### Edge function changes (`generate-outfits/index.ts`):
- Accept `rules` in request body
- Updated prompt example:
```text
COMPOSITION RULES:
- Each outfit MUST contain 3-5 items
- REQUIRED categories (always include): tops, bottoms
- OPTIONAL categories (include when available in catalog): shoes, bags, accessories, hats, sunglasses, jewelry
- Always try to include at least one item from the optional categories if the catalog has them
```

### Files to modify:
1. `supabase/functions/virtual-tryon/index.ts` -- faster model
2. `supabase/functions/generate-outfits/index.ts` -- accept rules, include accessories
3. `src/pages/Rules.tsx` -- DB-backed rules + composition UI
4. `src/pages/OutfitGenerator.tsx` -- fetch rules, pass to edge function
5. `src/pages/Widget.tsx` -- fetch rules, pass to edge function
6. `src/components/widget/tabs/OutfitsTab.tsx` -- pass rules to edge function
7. Database migration -- seed composition rule for existing brands

