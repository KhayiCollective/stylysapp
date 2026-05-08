
-- 1. Remove the open "Widget can view products by brand_id" SELECT policy.
-- Edge functions use the service role and bypass RLS, so the public policy
-- granting SELECT to everyone is unnecessary and dangerous.
DROP POLICY IF EXISTS "Widget can view products by brand_id" ON public.products;

-- 2. Restrict access to sensitive credential columns on the brands table.
-- Authenticated members can still SELECT the row (needed for app behavior),
-- but the API role can no longer read credential columns directly.
-- The get_brand_shopify_token() SECURITY DEFINER function remains the only
-- way for owners to access tokens.
REVOKE SELECT (shopify_access_token, shopify_storefront_token,
               woocommerce_consumer_key, woocommerce_consumer_secret)
  ON public.brands FROM anon, authenticated;

-- 3. Add an explicit owner-only DELETE policy on rules for defense-in-depth.
DROP POLICY IF EXISTS "Owners can delete rules in their brand" ON public.rules;
CREATE POLICY "Owners can delete rules in their brand"
  ON public.rules FOR DELETE
  USING (
    brand_id = get_user_brand_id(auth.uid())
    AND has_role(auth.uid(), 'owner'::app_role)
  );

-- 4. Storage policies for the private customer-photos bucket.
-- Edge functions use the service role and bypass RLS. Block all direct
-- client access (anon + authenticated) to objects in this bucket.
DROP POLICY IF EXISTS "Block client access to customer-photos" ON storage.objects;
CREATE POLICY "Block client access to customer-photos"
  ON storage.objects FOR ALL
  TO anon, authenticated
  USING (bucket_id <> 'customer-photos')
  WITH CHECK (bucket_id <> 'customer-photos');

-- 5. Tighten EXECUTE on SECURITY DEFINER functions that should never be
-- called directly by clients (triggers + edge-function-only helpers).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_customer_email(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_profile_email(uuid) FROM anon, public;

-- 6. Fix get_user_brand_id signature: it ignores its parameter and uses
-- auth.uid() internally. Make the implementation honor the parameter.
CREATE OR REPLACE FUNCTION public.get_user_brand_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT brand_id FROM public.profiles WHERE id = _user_id
$$;
