-- Re-add anon SELECT policies for the embedded Shopify admin app, scoped to
-- brands that have a shopify_store_domain (i.e. real connected stores).
-- The prior USING(true) policies were dropped as too broad; these are scoped.
-- Credential columns on brands are already revoked to anon by migration
-- 20260508141053, so no sensitive data is exposed here.

-- Ensure table-level SELECT grant is in place (idempotent)
GRANT SELECT ON public.brands TO anon;
GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.rules TO anon;

DROP POLICY IF EXISTS "Embedded app read brands" ON public.brands;
CREATE POLICY "Embedded app read brands"
  ON public.brands FOR SELECT TO anon
  USING (shopify_store_domain IS NOT NULL);

DROP POLICY IF EXISTS "Embedded app read rules" ON public.rules;
CREATE POLICY "Embedded app read rules"
  ON public.rules FOR SELECT TO anon
  USING (
    brand_id IN (
      SELECT id FROM public.brands WHERE shopify_store_domain IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Embedded app read products" ON public.products;
CREATE POLICY "Embedded app read products"
  ON public.products FOR SELECT TO anon
  USING (
    brand_id IN (
      SELECT id FROM public.brands WHERE shopify_store_domain IS NOT NULL
    )
  );
