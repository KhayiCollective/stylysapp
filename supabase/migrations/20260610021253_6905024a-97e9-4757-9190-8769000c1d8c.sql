ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_type text,
  ADD COLUMN IF NOT EXISTS collections jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS images_json jsonb DEFAULT '[]'::jsonb;