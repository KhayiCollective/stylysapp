

# Differentiate Client (Merchant) Backend vs Customer Frontend

## Overview

This is a significant architectural change to properly separate two user types:

1. **Merchant (Client)** -- uses the dashboard to manage products, sync catalog, configure rules, preview widget
2. **Customer (Shopper)** -- uses the storefront widget to browse outfits, save favorites, create a lightweight account (no Shopify credentials needed)

## What Changes

### 1. Database: `customer_accounts` table (NEW)

Create a new table for customer authentication, completely separate from the merchant `profiles`/`auth.users` system. Customers sign up with just email + password via a dedicated edge function -- no Supabase Auth session needed on the widget side.

```
customer_accounts
- id (uuid, PK)
- brand_id (uuid, FK to brands)
- email (text, NOT NULL)
- password_hash (text, NOT NULL)
- name (text)
- customer_id (uuid, FK to customers) -- links to existing quiz/preferences data
- created_at, updated_at
- UNIQUE(brand_id, email)
```

RLS: Service-role only (accessed via edge functions, never directly from client).

### 2. Database: `saved_outfits` table (NEW)

Persist customer-saved outfits so they survive sessions.

```
saved_outfits
- id (uuid, PK)
- customer_account_id (uuid, FK to customer_accounts)
- brand_id (uuid)
- outfit_data (jsonb) -- stores the outfit items snapshot
- name (text)
- created_at
```

### 3. Edge Function: `widget-customer-auth` (NEW)

Handles customer signup/login/session for the widget, completely independent of Supabase Auth:

- `POST /signup` -- creates account with email + hashed password, returns a signed JWT
- `POST /login` -- verifies credentials, returns JWT
- `POST /me` -- validates JWT, returns customer profile

This keeps customers entirely separate from merchant accounts.

### 4. Edge Function: `widget-outfits` (NEW)

Serves outfit data to the widget using real catalog products:

- `POST /generate` -- takes brand_id + customer preferences, fetches products from the catalog, calls the existing AI outfit generation logic
- `GET /saved` -- returns customer's saved outfits (requires customer JWT)
- `POST /save` -- saves an outfit (requires customer JWT)

### 5. Frontend: Outfit Generator (Dashboard) -- Use Real Catalog

Update `src/pages/OutfitGenerator.tsx` to fetch products from the `products` table instead of using hardcoded mock data. The merchant selects an anchor product from their synced catalog, and outfit generation uses real products.

### 6. Frontend: Widget Demo (`src/pages/Widget.tsx`) -- Sync with Catalog

Update the widget demo page to pull products from the brand's catalog instead of hardcoded mocks, so merchants see realistic previews.

### 7. Frontend: Widget Account Tab -- Real Auth

Update `src/components/widget/tabs/AccountTab.tsx` to call the `widget-customer-auth` edge function for signup/login instead of just toggling local state.

### 8. Frontend: Widget Outfits Tab -- Real Data

Update `src/components/widget/tabs/OutfitsTab.tsx` to fetch AI-generated outfits from the catalog via the `widget-outfits` edge function, and persist saves.

### 9. Routing -- No Changes Needed

The existing route structure already separates dashboard (protected) from widget/shop (public). No route changes required.

## What Stays the Same

- **Rules page** -- remains in the merchant dashboard only
- **Widget demo** -- remains in the merchant dashboard, but will pull from real catalog
- **Merchant auth** -- email/password via existing Supabase Auth, unchanged
- **Product catalog sync** -- Shopify/WooCommerce sync stays as-is
- **Widget loader** -- script tag installation unchanged

## Implementation Order

1. Create `customer_accounts` and `saved_outfits` tables with migrations
2. Build `widget-customer-auth` edge function
3. Build `widget-outfits` edge function  
4. Update Outfit Generator to use real catalog
5. Update Widget demo to use real catalog
6. Update widget AccountTab for real customer auth
7. Update widget OutfitsTab for real outfit data

## Technical Notes

- Customer passwords are hashed with a secure algorithm (bcrypt via Deno) in the edge function -- never stored in plain text
- Customer JWTs are short-lived tokens signed with a secret, validated by widget edge functions
- The `customers` table (existing) stores quiz/preferences data and gets linked to `customer_accounts` via the `customer_id` foreign key
- Products RLS will need a new policy allowing anonymous SELECT for widget access (scoped by brand_id) so the widget can display catalog items

