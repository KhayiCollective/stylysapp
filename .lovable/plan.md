

# Update Favicon and Widget Icon

## Summary
Replace the browser favicon and the widget floating button icon (on merchant store homepages) with the new STYLYS logo image.

## Steps

### 1. Copy the new icon into the project
- Copy `user-uploads://stylys_icon_1200_x_1200_px-2.png` to `public/favicon.png` (for the favicon)
- Copy the same file to `src/assets/stylys-icon.png` (for use in React components)

### 2. Update favicon in `index.html`
- Change `<link rel="icon" type="image/x-icon" href="/favicon.jpg">` to `<link rel="icon" type="image/png" href="/favicon.png">`

### 3. Update Dashboard Layout (`src/components/layout/DashboardLayout.tsx`)
- Change the logo import from `stylys-icon.jpg` to `stylys-icon.png`

### 4. Update Widget floating button icon (`supabase/functions/widget-loader/index.ts`)
- Replace the inline SVG sparkle icon (line 40) with an `<img>` tag using the published favicon URL: `https://stylysapp.lovable.app/favicon.png`
- The button will show the STYLYS "S" logo instead of a generic sparkle
- Adjust styling to ensure the image fits nicely in the circular button (e.g., `width:32px; height:32px; border-radius:50%; object-fit:cover;`)

### 5. Update Widget sidebar component (`src/components/widget/CustomerWidget.tsx`)
- Import the new `stylys-icon.png` asset
- Replace the `Sparkles` icon in the widget header, mobile floating button, and desktop edge tab with the STYLYS icon image

## What stays unchanged
- Widget functionality and layout
- All dashboard pages and routing
- Edge function logic (only the button HTML changes)

