-- Seed default styling rules for stylys-2.myshopify.com
-- Uses a subquery so no hardcoded brand_id is needed.

DO $$
DECLARE
  v_brand_id UUID;
BEGIN
  SELECT id INTO v_brand_id
  FROM public.brands
  WHERE shopify_store_domain = 'stylys-2.myshopify.com'
  LIMIT 1;

  IF v_brand_id IS NULL THEN
    RAISE EXCEPTION 'Brand not found for stylys-2.myshopify.com';
  END IF;

  -- Skip if rules already exist for this brand
  IF EXISTS (SELECT 1 FROM public.rules WHERE brand_id = v_brand_id) THEN
    RAISE NOTICE 'Rules already exist for brand %, skipping seed.', v_brand_id;
    RETURN;
  END IF;

  INSERT INTO public.rules (brand_id, name, description, category, enabled, config) VALUES
    -- Styling Rules
    (v_brand_id, 'Color Harmony',    'Ensure outfit colors complement each other using color theory principles', 'styling',     true, '{}'::jsonb),
    (v_brand_id, 'Fit Balance',      'Balance fitted and relaxed pieces for a cohesive silhouette',              'styling',     true, '{}'::jsonb),
    (v_brand_id, 'Category Balance', 'Ensure outfits contain a good mix of product categories',                  'styling',     true, '{}'::jsonb),
    -- Inventory Rules
    (v_brand_id, 'In-Stock Only',    'Only include products that are currently in stock',                        'inventory',   true, '{}'::jsonb),
    -- Pricing Rules
    (v_brand_id, 'Price Range Match','Keep outfit total within a reasonable price range for the customer',       'pricing',     true, '{}'::jsonb),
    -- Outfit Composition
    (v_brand_id, 'Outfit Composition', 'Control the structure and category makeup of generated outfits',        'composition', true,
      '{"minItems":3,"maxItems":6,"requiredCategories":["tops","bottoms","shoes"],"optionalCategories":["bags","accessories","hats","sunglasses","jewelry"]}'::jsonb
    );

  RAISE NOTICE 'Seeded 6 rules for brand %.', v_brand_id;
END;
$$;
