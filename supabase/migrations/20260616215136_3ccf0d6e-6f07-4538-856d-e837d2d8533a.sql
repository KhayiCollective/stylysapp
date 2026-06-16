ALTER TABLE public.brands 
  ADD COLUMN IF NOT EXISTS shopify_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS shopify_token_expires_at TIMESTAMPTZ;