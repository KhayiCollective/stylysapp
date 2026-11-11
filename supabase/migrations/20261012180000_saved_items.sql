-- Individual products a customer has hearted (Pro feature: pick-your-own Try-On).
-- Accessed only through the widget-outfits edge function (service role), same
-- pattern as saved_outfits: RLS on, no policies.
CREATE TABLE IF NOT EXISTS public.saved_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_account_id UUID NOT NULL REFERENCES public.customer_accounts(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (customer_account_id, product_id)
);

CREATE INDEX IF NOT EXISTS saved_items_customer_idx ON public.saved_items (customer_account_id, brand_id);

ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;
-- No policies = only service_role can access
