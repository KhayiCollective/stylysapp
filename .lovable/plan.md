

# Virtual Try-On Result Swap + New Widget Icon

## 1. Try-On: Result Replaces Uploaded Photo

Currently, the generated outfit image appears below the uploaded photo, requiring users to scroll. Instead, once the AI result is ready, it will **replace** the uploaded photo in the same position. The user can tap a button to swap back to their original photo or re-generate.

### File: `src/components/widget/tabs/TryOnTab.tsx`
- When `resultImage` exists, show it in place of the `userImage` (same container, same position)
- Add a small "View Original" / "View Result" toggle button on the image so users can compare
- Remove the separate result section at the bottom
- Keep the "AI Generated" badge on the result image

### File: `src/components/VirtualTryOn.tsx`
- Same pattern: when `resultImage` exists, swap it into the user photo area instead of rendering a separate section below
- Add a toggle to flip between original and result

## 2. New Widget Floating Button Icon

Replace the current `stylys-icon.png` with the uploaded `S_no_border.png` logo.

### Files:
- **Copy** `user-uploads://S_no_border.png` to `src/assets/S_no_border.png`
- **`src/components/widget/CustomerWidget.tsx`**: Change the import from `stylys-icon.png` to `S_no_border.png` for the floating button, edge tab, and header icon
- **`supabase/functions/widget-loader/index.ts`**: Update the `btn.innerHTML` image URL. Since edge functions cannot reference bundled assets, we will copy the icon to `public/S_no_border.png` as well and reference it via the published app URL (`https://stylysapp.lovable.app/S_no_border.png`)

---

## Technical Details

### TryOnTab.tsx changes
- Add a `showingResult` boolean derived from `!!resultImage`
- The image container shows `resultImage` when available, otherwise `userImage`
- Overlay buttons: "View Original" (swaps display temporarily) and X (clears everything)
- The "Try It On" button text changes to "Try Again" after a result is generated
- No scrolling needed -- everything stays in view

### VirtualTryOn.tsx changes
- Same swap logic: result replaces user photo in the same `aspect-[3/4]` container
- Toggle between views with a small button overlay

### Widget icon files
- Copy uploaded image to both `src/assets/S_no_border.png` (for React import) and `public/S_no_border.png` (for edge function URL)
- Update all three icon references in CustomerWidget (floating button, edge tab, header)
- Update widget-loader edge function icon URL and redeploy
