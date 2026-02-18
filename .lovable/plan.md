

# Update Widget Icon + Save Customer Photo for Try-On

## Overview
Two changes: (1) swap the widget icon to the new larger STYLYS logo, and (2) let customers save their full-body photo to their account so they never have to re-upload it for virtual try-on.

---

## 1. New Widget Icon

Replace `S_no_border.png` with the new uploaded `S_no_border-2.png` across all locations.

### Files:
- **Copy** `user-uploads://S_no_border-2.png` to `src/assets/S_no_border.png` (overwrite) and `public/S_no_border.png` (overwrite)
- **`supabase/functions/widget-loader/index.ts`**: Bump the cache-busting version param from `?v=1` to `?v=3`
- No import changes needed in `CustomerWidget.tsx` or `InlineCustomerWidget.tsx` since the filename stays the same

---

## 2. Persistent Customer Photo for Try-On

**Problem:** Every time a customer wants to try on an outfit, they must re-upload their full-body photo. This is tedious and creates friction.

**Solution:** 
- Create a storage bucket (`customer-photos`) for customer body photos
- Add a `photo_url` column to the `customer_accounts` table
- When a customer uploads a photo in the Try-On tab, save it to storage and store the URL on their account
- On next visit, auto-load their saved photo so they can immediately try on outfits
- Allow them to change/update their photo anytime

### Database Migration:
- Add `photo_url TEXT` column to `customer_accounts`
- Create `customer-photos` storage bucket (public, so images can be displayed)
- Add storage RLS policies for uploading/reading photos

### Backend: `supabase/functions/widget-customer-auth/index.ts`
- Add a new `/photo` endpoint that accepts a base64 image, uploads it to the `customer-photos` bucket, and updates the customer's `photo_url`
- The `/me` endpoint already returns customer data -- include `photo_url` in the response

### Frontend: `src/components/widget/tabs/TryOnTab.tsx`
- Accept a new `customerPhotoUrl` prop (the saved photo URL from the account)
- On mount, if `customerPhotoUrl` exists, pre-load it as the `userImage`
- When the user uploads a new photo, also save it to their account via the `/photo` endpoint
- Show a small indicator that their photo is saved ("Your saved photo" label)
- Keep the X button to clear and upload a different photo

### Frontend: `src/components/widget/tabs/AccountTab.tsx`
- Show the saved photo in the account home view (small thumbnail)
- Expose `customerPhotoUrl` so parent components can pass it down

### Frontend: `src/components/widget/CustomerWidget.tsx` and `InlineCustomerWidget.tsx`
- Thread the customer's saved photo URL from AccountTab through to TryOnTab
- This requires lifting the customer state slightly -- pass a `customerPhotoUrl` state from the widget root that gets set when the customer logs in

### Frontend: `src/components/VirtualTryOn.tsx`
- Same pattern: accept an optional `savedPhotoUrl` prop to pre-populate the user photo

---

## Technical Details

### Storage bucket setup (migration SQL):
```text
- Create bucket: customer-photos (public)
- RLS on storage.objects: anyone can upload to customer-photos (since widget customers aren't Supabase auth users, uploads go through the edge function)
- Photos are stored as: customer-photos/{customer_account_id}/photo.jpg
```

### New edge function endpoint: `widget-customer-auth/photo`
- Method: POST
- Auth: Bearer token (customer JWT)
- Body: `{ photoBase64: string }`
- Process: decode base64, upload to storage bucket, update `customer_accounts.photo_url`
- Response: `{ photo_url: string }`

### TryOnTab prop changes:
- New prop: `customerPhotoUrl?: string`
- New prop: `brandId?: string` (needed to call the save endpoint)
- New prop: `customerToken?: string` (needed for auth on save)
- On first render: if `customerPhotoUrl` exists, fetch it and set as `userImage`
- After upload: call `/photo` endpoint to persist, then continue with try-on as normal

### Data flow:
```text
CustomerWidget
  -> AccountTab logs in, gets customerUser with photo_url
  -> CustomerWidget stores customerPhotoUrl in state
  -> TryOnTab receives customerPhotoUrl, auto-loads it
  -> When user uploads new photo in TryOnTab, saves via edge function
  -> CustomerWidget updates its customerPhotoUrl state
```

### Files to modify:
1. Copy new icon to `src/assets/S_no_border.png` and `public/S_no_border.png`
2. `supabase/functions/widget-loader/index.ts` -- bump icon version
3. Database migration -- add `photo_url` column + storage bucket
4. `supabase/functions/widget-customer-auth/index.ts` -- add `/photo` endpoint, include `photo_url` in `/me` response
5. `src/components/widget/tabs/TryOnTab.tsx` -- accept saved photo, auto-load, save on upload
6. `src/components/widget/tabs/AccountTab.tsx` -- expose photo URL
7. `src/components/widget/CustomerWidget.tsx` -- thread photo state
8. `src/components/widget/InlineCustomerWidget.tsx` -- thread photo state
9. `src/components/VirtualTryOn.tsx` -- accept optional saved photo

