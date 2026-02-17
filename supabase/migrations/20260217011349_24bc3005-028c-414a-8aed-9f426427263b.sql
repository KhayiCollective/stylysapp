
-- Add source tracking to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS woocommerce_product_id text;

-- Add WooCommerce credentials to brands
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS woocommerce_store_url text;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS woocommerce_consumer_key text;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS woocommerce_consumer_secret text;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS woocommerce_connected_at timestamptz;
