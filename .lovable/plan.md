
# Body-Aware Virtual Try-On

## What Changes

The virtual try-on will use the customer's saved body shape and sizing information from their account profile to generate more accurate, personalized results. When a logged-in customer triggers "Try It On," their body shape (e.g., Hourglass, Pear) and sizes (tops, bottoms, shoes) are sent along with the photo and outfit items to the AI, which uses this context to render garments with realistic fit and proportions.

## How It Works Today

- The AI prompt says "Maintain the person's face, body shape, and pose" but only has the photo to work from
- Customer profile data (body shape, size info) exists in the database but is never passed to the try-on function
- The AI guesses proportions purely from the uploaded image

## What Will Change

### 1. Pass profile data from widget to the edge function

**File: `src/components/widget/InlineCustomerWidget.tsx`**
- Store the customer's `styleProfile` (body shape + sizing) in state when they log in
- Pass `bodyShape` and `sizeInfo` down to the `TryOnTab` component as new props

**File: `src/components/widget/tabs/TryOnTab.tsx`**
- Accept new optional props: `bodyShape` and `sizeInfo`
- Include these in the request body when calling the `virtual-tryon` function

### 2. Enhance the AI prompt with body context

**File: `supabase/functions/virtual-tryon/index.ts`**
- Accept optional `bodyShape` and `sizeInfo` fields in the request body
- When present, add a body context section to the AI prompt that instructs the model to:
  - Adjust garment draping and silhouette based on the body shape (e.g., "Pear shape: wider hips, narrower shoulders")
  - Use sizing info to determine how fitted or loose garments should appear (e.g., size XS tops should look snug, size 32 bottoms should fit accordingly)
  - Ensure proportions match the described body type even if the photo is partially cropped or unclear

### 3. Show profile status on the Try-On tab

**File: `src/components/widget/tabs/TryOnTab.tsx`**
- When body shape / sizing data is available, show a small badge like "Personalized to your body profile" above the generate button
- When not available, show a subtle hint: "Add your body shape and sizing in Account for better results"

## Technical Details

### Updated request interface (edge function)
```text
TryOnRequest {
  userImageBase64: string
  outfitItems: OutfitItem[]
  bodyShape?: string          // e.g. "Hourglass", "Pear"
  sizeInfo?: {                // e.g. { tops: "M", bottoms: "28", shoes: "8" }
    tops?: string
    bottoms?: string
    shoes?: string
  }
}
```

### AI prompt addition (when body data is present)
A new section will be injected into the existing prompt:
```text
BODY PROFILE:
- Body shape: Pear (wider hips relative to shoulders, defined waist)
- Sizing: Tops M, Bottoms 28, Shoes 8
- Adjust garment fit and draping to match this body type
- Tops should fit as a medium would on this body shape
- Bottoms should sit and drape as a size 28 would on a pear-shaped figure
```

Body shape descriptions will be mapped from the shape name to a brief physical description so the AI has clear anatomical context.

### Files to modify
- `supabase/functions/virtual-tryon/index.ts` -- add body context to prompt
- `src/components/widget/tabs/TryOnTab.tsx` -- accept and send profile data, show personalization indicator
- `src/components/widget/InlineCustomerWidget.tsx` -- pass style profile data to TryOnTab

### No database changes needed
All the data (body shape, size info) already exists in the `customers` table and is already fetched via the `widget-customer-auth/me` endpoint.
