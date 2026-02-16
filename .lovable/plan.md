

# Replace App Icon (Favicon)

## What will change
Replace the current favicon with your uploaded STYLYS icon image.

## Steps
1. Copy `user-uploads://stylys_icon.jpg` to `public/favicon.jpg`
2. Update `index.html` to reference the new local favicon file instead of the external URL

## Technical Details

| File | Change |
|------|--------|
| `public/favicon.jpg` | New file (copied from upload) |
| `index.html` | Update `<link rel="icon">` href from external URL to `/favicon.jpg` |

