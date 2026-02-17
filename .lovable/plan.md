

# Manual Widget Installation Fallback

## Problem
The re-authorization OAuth flow is not completing — Shopify never redirects back to the callback URL, so the access token never gets updated with `write_script_tags`. This blocks the automated Script Tag API approach entirely.

## Solution
Add a **manual installation option** in the WidgetStatus settings card. This gives you a simple script snippet to paste into your Shopify theme, bypassing the Script Tag API completely.

## How It Works for You
1. Go to Settings, find the Storefront Widget card
2. Click "Manual Install"
3. Copy the one-line script tag shown
4. In Shopify Admin, go to Online Store > Themes > Edit code > `theme.liquid`
5. Paste the script just before `</body>`
6. Save — the widget appears immediately on your storefront

## Technical Changes

### 1. `src/components/settings/WidgetStatus.tsx`
- Add a "Manual Install" section below the existing toggle button
- Show the exact script snippet:  
  `<script src="https://.../functions/v1/widget-loader?brand_id=..." defer></script>`
- Include a "Copy to Clipboard" button for convenience
- Show step-by-step instructions for pasting into `theme.liquid`
- Keep the existing automated toggle + re-authorize flow as-is for when OAuth eventually works

### 2. No backend changes needed
The `widget-loader` edge function already works — it returns the JavaScript correctly regardless of how the script is loaded. The only thing that's broken is the *Script Tag API call* that automates injecting it. Manual paste achieves the same result.

