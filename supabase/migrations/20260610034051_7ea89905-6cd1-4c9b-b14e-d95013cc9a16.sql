
CREATE TABLE public.back_in_stock_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  shopify_variant_id TEXT,
  product_name TEXT,
  email TEXT NOT NULL,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bisn_brand ON public.back_in_stock_notifications(brand_id);
CREATE INDEX idx_bisn_variant ON public.back_in_stock_notifications(shopify_variant_id);
CREATE UNIQUE INDEX idx_bisn_unique ON public.back_in_stock_notifications(brand_id, shopify_variant_id, email) WHERE shopify_variant_id IS NOT NULL;

GRANT SELECT ON public.back_in_stock_notifications TO authenticated;
GRANT ALL ON public.back_in_stock_notifications TO service_role;

ALTER TABLE public.back_in_stock_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brand owners can view their notifications"
  ON public.back_in_stock_notifications FOR SELECT
  TO authenticated
  USING (brand_id = public.get_user_brand_id(auth.uid()));
