
# Update Contact Email to support@stylysapp.com

## Overview
Replace all instances of `info@hausofkhayi.com` with `support@stylysapp.com` across 4 files.

## Files to Change

### 1. `src/pages/Support.tsx` (line 231)
- Change `info@hausofkhayi.com` to `support@stylysapp.com` in the Email Support card

### 2. `src/pages/Privacy.tsx` (line 157)
- Change `info@hausofkhayi.com` to `support@stylysapp.com` in the contact information section

### 3. `src/pages/docs/FAQ.tsx` (line 79)
- Change `info@hausofkhayi.com` to `support@stylysapp.com` in the refund policy answer

### 4. `supabase/functions/support-chat/index.ts` (line 34)
- Change `info@hausofkhayi.com` to `support@stylysapp.com` in the AI chatbot system prompt

## Notes
- Frontend changes require publishing to go live
- The edge function change deploys automatically
