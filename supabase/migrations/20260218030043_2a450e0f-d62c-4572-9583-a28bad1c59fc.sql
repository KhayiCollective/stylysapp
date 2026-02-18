
-- Allow users to insert rules in their brand (needed for composition rule upsert)
CREATE POLICY "Users can insert rules in their brand"
ON public.rules
FOR INSERT
WITH CHECK (brand_id = get_user_brand_id(auth.uid()));

-- Insert default Outfit Composition rule for all existing brands that don't have one
INSERT INTO public.rules (brand_id, name, category, description, enabled, config)
SELECT b.id, 'Outfit Composition', 'composition', 
  'Configure how many items and which categories to include in generated outfits',
  true,
  '{"minItems": 3, "maxItems": 5, "requiredCategories": ["tops", "bottoms"], "optionalCategories": ["shoes", "bags", "accessories", "hats", "sunglasses", "jewelry"]}'::jsonb
FROM public.brands b
WHERE NOT EXISTS (
  SELECT 1 FROM public.rules r WHERE r.brand_id = b.id AND r.category = 'composition'
);

-- Also update handle_new_user to seed the composition rule for new brands
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_brand_id UUID;
BEGIN
  INSERT INTO public.brands (name, slug)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'brand_name', 'My Brand'),
    COALESCE(NEW.raw_user_meta_data->>'brand_slug', 'brand-' || substr(NEW.id::text, 1, 8))
  )
  RETURNING id INTO new_brand_id;

  INSERT INTO public.profiles (id, brand_id, email, full_name)
  VALUES (
    NEW.id,
    new_brand_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'owner');

  INSERT INTO public.widget_config (brand_id)
  VALUES (new_brand_id);

  INSERT INTO public.rules (brand_id, name, category, description, enabled, config) VALUES
    (new_brand_id, 'Category Balance', 'styling', 'Ensure outfits have complementary categories (top + bottom + optional layer)', true, '{}'::jsonb),
    (new_brand_id, 'Color Harmony', 'styling', 'Limit outfits to max 3 dominant colors for visual cohesion', true, '{}'::jsonb),
    (new_brand_id, 'Fit Balance', 'styling', 'Pair oversized items with fitted pieces for balanced silhouettes', true, '{}'::jsonb),
    (new_brand_id, 'In-Stock Only', 'inventory', 'Only include products that are currently in stock', true, '{}'::jsonb),
    (new_brand_id, 'Price Range Match', 'pricing', 'Match outfit price range to customer budget preferences', true, '{}'::jsonb),
    (new_brand_id, 'Seasonal Relevance', 'styling', 'Prioritize seasonally appropriate items', true, '{}'::jsonb),
    (new_brand_id, 'Outfit Composition', 'composition', 'Configure how many items and which categories to include in generated outfits', true, 
      '{"minItems": 3, "maxItems": 5, "requiredCategories": ["tops", "bottoms"], "optionalCategories": ["shoes", "bags", "accessories", "hats", "sunglasses", "jewelry"]}'::jsonb);

  RETURN NEW;
END;
$function$;
