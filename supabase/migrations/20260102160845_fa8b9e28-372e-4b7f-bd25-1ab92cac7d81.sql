-- Add Shopify-specific columns to products table for sync
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS shopify_product_id text,
ADD COLUMN IF NOT EXISTS shopify_variant_id text,
ADD COLUMN IF NOT EXISTS shopify_handle text;

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_products_shopify_product_id ON public.products(shopify_product_id);
CREATE INDEX IF NOT EXISTS idx_products_shopify_variant_id ON public.products(shopify_variant_id);

-- Add unique constraint to prevent duplicate syncs per brand
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_brand_shopify_variant 
ON public.products(brand_id, shopify_variant_id) 
WHERE shopify_variant_id IS NOT NULL;