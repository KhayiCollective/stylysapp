-- Create trigger to auto-create brand and profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_brand_id UUID;
BEGIN
  -- Create a new brand for this user
  INSERT INTO public.brands (name, slug)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'brand_name', 'My Brand'),
    COALESCE(NEW.raw_user_meta_data->>'brand_slug', 'brand-' || substr(NEW.id::text, 1, 8))
  )
  RETURNING id INTO new_brand_id;

  -- Create profile linked to user and brand
  INSERT INTO public.profiles (id, brand_id, email, full_name)
  VALUES (
    NEW.id,
    new_brand_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );

  -- Assign owner role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'owner');

  -- Create default widget config
  INSERT INTO public.widget_config (brand_id)
  VALUES (new_brand_id);

  -- Seed default rules
  INSERT INTO public.rules (brand_id, name, category, description, enabled) VALUES
    (new_brand_id, 'Category Balance', 'styling', 'Ensure outfits have complementary categories (top + bottom + optional layer)', true),
    (new_brand_id, 'Color Harmony', 'styling', 'Limit outfits to max 3 dominant colors for visual cohesion', true),
    (new_brand_id, 'Fit Balance', 'styling', 'Pair oversized items with fitted pieces for balanced silhouettes', true),
    (new_brand_id, 'In-Stock Only', 'inventory', 'Only include products that are currently in stock', true),
    (new_brand_id, 'Price Range Match', 'pricing', 'Match outfit price range to customer budget preferences', true),
    (new_brand_id, 'Seasonal Relevance', 'styling', 'Prioritize seasonally appropriate items', true);

  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();