CREATE TABLE IF NOT EXISTS public.restock_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL,
  product_id uuid NULL,
  shopify_variant_id text NULL,
  product_name text NULL,
  email text NOT NULL,
  notified_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restock_notifications_brand ON public.restock_notifications(brand_id);
CREATE INDEX IF NOT EXISTS idx_restock_notifications_variant ON public.restock_notifications(shopify_variant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_restock_notifications_brand_variant_email
  ON public.restock_notifications(brand_id, shopify_variant_id, email)
  WHERE shopify_variant_id IS NOT NULL;

GRANT SELECT, INSERT ON public.restock_notifications TO authenticated;
GRANT ALL ON public.restock_notifications TO service_role;

ALTER TABLE public.restock_notifications ENABLE ROW LEVEL SECURITY;

-- Brand owners can view their restock notifications
CREATE POLICY "Brand owners view restock notifications"
ON public.restock_notifications FOR SELECT
TO authenticated
USING (brand_id = public.get_user_brand_id(auth.uid()));
