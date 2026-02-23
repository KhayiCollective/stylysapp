

# Fix: Style Me Button, Anchor Product, and Default Tab

## Three Issues Found

### Issue 1: "Build Outfit" button does nothing on Product Detail page
**Root cause**: In `ProductDetail.tsx`, `useWidgetControl()` is called at line 24 *outside* the `WidgetControlContext.Provider` which lives inside `ShopLayout`. React context only works for components *inside* the provider, but `ProductDetail` is the parent that renders `ShopLayout`. So `buildOutfitAround` is the default no-op function `() => {}`.

**Fix**: Extract the product detail content into a separate inner component (`ProductDetailContent`) rendered as a child of `ShopLayout`, so it's inside the context provider.

```text
Before:
  ProductDetail (calls useWidgetControl -- OUTSIDE provider)
    ShopLayout (provides context)
      content

After:
  ProductDetail
    ShopLayout (provides context)
      ProductDetailContent (calls useWidgetControl -- INSIDE provider)
```

### Issue 2: Widget generates outfits but ignores the selected product
**Root cause**: The widget hardcodes `brandId="f7bfce23-f46a-4125-9fa8-e1bf4c7fd2bf"` (Haus of Khayi) but all 295 products in the database are under brand `cbfe18b2-b2f2-444f-a6fc-bbf9439c37a7` (STYLYS APP). The edge function can't find ANY products for the wrong brand, so either it returns nothing or falls back incorrectly. Even if it did find products, the anchor matching would fail because there's no product under that brand to match against.

**Fix**: Update `ShopLayout.tsx` to use the correct brand ID `cbfe18b2-b2f2-444f-a6fc-bbf9439c37a7` for the `CustomerWidget`.

### Issue 3: Widget opens to Account tab instead of Outfits tab
**Root cause**: `ShopLayout` always passes `externalTab={widgetTab}` to `CustomerWidget`, which defaults to `"outfits"`. However, the `CustomerWidget`'s `activeTab` uses `externalTab ?? internalTab` -- since `externalTab` is always provided (never `undefined`), it always overrides. This should actually work correctly. But the widget's tab state in `ShopLayout` is initialized once; if at any point `setWidgetTab("account")` was called (via `openAccountTab`), it stays on `"account"` until explicitly changed.

**Fix**: When the widget opens (either via the side button or programmatically), ensure `widgetTab` defaults to `"outfits"` for logged-in users. Update `CustomerWidget` so that when it opens and the user is logged in, it resets to the outfits tab unless an explicit tab override was requested (like from `buildOutfitAround`).

---

## Files to Change

### 1. `src/pages/ProductDetail.tsx`
- Move all product detail logic into a new `ProductDetailContent` inner component
- `ProductDetail` just renders `<ShopLayout><ProductDetailContent /></ShopLayout>`
- `ProductDetailContent` calls `useWidgetControl()` inside the provider

### 2. `src/components/shop/ShopLayout.tsx`
- Change hardcoded brand ID from `f7bfce23-f46a-4125-9fa8-e1bf4c7fd2bf` to `cbfe18b2-b2f2-444f-a6fc-bbf9439c37a7`
- When widget opens via the side button (not via `buildOutfitAround` or `openAccountTab`), default `widgetTab` to `"outfits"` if user is logged in

### 3. `src/components/widget/CustomerWidget.tsx`
- Add a `useEffect` that resets `activeTab` to `"outfits"` when the widget opens and the user is logged in (unless a specific tab was set externally, like from `buildOutfitAround`)

