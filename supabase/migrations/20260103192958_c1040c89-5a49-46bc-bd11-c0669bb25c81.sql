-- Create a brand_info view that excludes sensitive Shopify tokens
-- This view is what the frontend should use for brand info
CREATE OR REPLACE VIEW public.brand_info 
WITH (security_invoker = true)
AS
SELECT 
  id,
  name,
  slug,
  logo_url,
  shopify_store_domain,
  shopify_connected_at,
  created_at,
  updated_at
  -- Explicitly excluding: shopify_access_token, shopify_storefront_token
FROM public.brands;

-- Grant access to authenticated users
GRANT SELECT ON public.brand_info TO authenticated;

-- Create a security definer function to get Shopify tokens ONLY for backend use
-- This should only be called by edge functions, never from client code
CREATE OR REPLACE FUNCTION public.get_brand_shopify_token(target_brand_id uuid)
RETURNS TABLE (access_token text, storefront_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_brand_id UUID;
BEGIN
  -- Get the caller's brand_id
  caller_brand_id := get_user_brand_id(auth.uid());
  
  -- Only return tokens if caller is an owner of the same brand
  IF has_role(auth.uid(), 'owner') AND caller_brand_id = target_brand_id THEN
    RETURN QUERY 
    SELECT b.shopify_access_token, b.shopify_storefront_token 
    FROM brands b 
    WHERE b.id = target_brand_id;
    RETURN;
  END IF;
  
  -- Access denied - return empty result
  RETURN;
END;
$$;

-- Revoke direct execute from public
REVOKE EXECUTE ON FUNCTION public.get_brand_shopify_token(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_brand_shopify_token(uuid) TO authenticated;