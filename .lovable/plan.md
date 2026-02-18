

# Consolidate Navigation: Move Customer Outfits to Dashboard + Widget Demo to Rules

## What Changes

### 1. Remove Two Sidebar Items
Remove "Customer Outfits" (`/wishlist`) and "Widget Demo" (`/widget`) from the sidebar navigation in `DashboardLayout.tsx`. The sidebar will have: Dashboard, Catalog, Rules, Settings, Docs, Support.

### 2. Add Customer Outfits Section to Dashboard
Move the saved-outfits grid from `Wishlist.tsx` into the bottom of `Dashboard.tsx` as a new "Customer Outfits" card section. It will show the most recent saved outfits (limit ~6) with a count summary. This keeps the merchant's analytics and customer engagement data in one view.

### 3. Embed Widget Demo at Bottom of Rules Page
Move the "Complete the Look" widget preview from `Widget.tsx` into the bottom of `Rules.tsx`. This way, when a merchant toggles rules or adjusts composition settings, they can immediately scroll down and see how those rules affect the live widget demo -- making it a feedback loop for fine-tuning.

### 4. Clean Up Routes
Remove the `/wishlist` and `/widget` routes from `App.tsx` (or redirect them to `/dashboard` and `/rules` respectively). The standalone page files can be kept for reference or deleted.

---

## Technical Details

### `src/components/layout/DashboardLayout.tsx`
- Remove the two navigation entries: `{ name: "Customer Outfits", href: "/wishlist", icon: Heart }` and `{ name: "Widget Demo", href: "/widget", icon: ExternalLink }`

### `src/pages/Dashboard.tsx`
- Add a query for `saved_outfits` (same logic as current `Wishlist.tsx`): fetch by `brand_id`, order by `created_at desc`, limit 6
- Render a new "Customer Outfits" card at the bottom of the dashboard with the outfit grid (image mosaic + item count + date)
- Show empty state if none exist yet

### `src/pages/Rules.tsx`
- Add the widget demo section at the bottom after all rule categories
- Port the core logic from `Widget.tsx`: fetch products, select anchor product, generate outfits using the current rules, display the "Complete the Look" card
- The key benefit: when a merchant changes a rule above and scrolls down, the demo reflects those changes (they can click a "Refresh Preview" button to re-generate with the updated rules)

### `src/App.tsx`
- Remove or redirect the `/wishlist` and `/widget` routes
- Keep the page files intact (no deletion needed) to avoid breaking any deep links -- just remove from nav

### Files to modify:
1. `src/components/layout/DashboardLayout.tsx` -- remove 2 nav items
2. `src/pages/Dashboard.tsx` -- add customer outfits section
3. `src/pages/Rules.tsx` -- add widget demo preview at bottom
4. `src/App.tsx` -- remove/redirect old routes
