-- Allow the Shopify embedded app to read brand, product, and rule data without
-- a Supabase auth session.  The embedded app runs inside the Shopify Admin
-- iframe where merchants are already authenticated by Shopify; no Supabase
-- session is issued in this flow.
--
-- Credential columns (shopify_access_token, storefront_token, etc.) are
-- already column-level REVOKED from the anon role by the security migration,
-- so adding row-level SELECT here does not expose those values.

-- brands: anon can read non-sensitive columns (credential columns are column-revoked)
CREATE POLICY "Embedded app read brands"
  ON public.brands
  FOR SELECT
  TO anon
  USING (true);

-- products: anon can read all product rows (scoped by brand_id in app queries)
CREATE POLICY "Embedded app read products"
  ON public.products
  FOR SELECT
  TO anon
  USING (true);

-- rules: anon can read styling rule configuration (scoped by brand_id in app queries)
CREATE POLICY "Embedded app read rules"
  ON public.rules
  FOR SELECT
  TO anon
  USING (true);
