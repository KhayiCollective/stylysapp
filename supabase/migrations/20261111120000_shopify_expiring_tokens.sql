-- Shopify expiring offline access tokens (required for public apps by Jan 1, 2027).
-- A NULL shopify_token_expires_at means a legacy, non-expiring token that still
-- needs to be migrated by the shopify-migrate-tokens function.
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS shopify_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS shopify_token_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS shopify_refresh_token_expires_at TIMESTAMP WITH TIME ZONE;
