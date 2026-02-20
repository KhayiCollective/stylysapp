
## Replace Auth Page Icon with New Stylys Logo

Replace the current `stylys-icon.png` on the Auth page (line 74) with the uploaded `S_no_border-3.png` logo.

### Steps
1. Copy the uploaded image (`S_no_border-3.png`) to `src/assets/S_no_border.png` (overwriting the existing one, since the project already uses this asset name elsewhere).
2. Update the import in `src/pages/Auth.tsx` from `stylys-icon.png` to `S_no_border.png`.
3. Swap the `<img>` src on both the desktop (line 74) and mobile (line 113) logos to use the new asset.

### Technical Details
- **File to copy**: `user-uploads://S_no_border-3.png` -> `src/assets/S_no_border.png`
- **File to edit**: `src/pages/Auth.tsx`
  - Change import: `import stylysIcon from '@/assets/stylys-icon.png'` -> `import stylysLogo from '@/assets/S_no_border.png'`
  - Update both `<img src={stylysIcon} ...>` references to use `stylysLogo`
