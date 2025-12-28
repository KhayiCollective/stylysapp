-- Add Shopify connection fields to brands table
ALTER TABLE public.brands 
ADD COLUMN IF NOT EXISTS shopify_store_domain text,
ADD COLUMN IF NOT EXISTS shopify_access_token text,
ADD COLUMN IF NOT EXISTS shopify_storefront_token text,
ADD COLUMN IF NOT EXISTS shopify_connected_at timestamp with time zone;

-- Add index for store domain lookups
CREATE INDEX IF NOT EXISTS idx_brands_shopify_store_domain ON public.brands(shopify_store_domain);

-- Add constraint to ensure store domain is unique
ALTER TABLE public.brands ADD CONSTRAINT unique_shopify_store_domain UNIQUE (shopify_store_domain);