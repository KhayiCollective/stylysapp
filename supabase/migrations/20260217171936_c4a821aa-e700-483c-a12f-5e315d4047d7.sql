
-- 1. customer_accounts table (widget customer auth, separate from merchant auth)
CREATE TABLE public.customer_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(brand_id, email)
);

-- RLS: service-role only (edge functions access via service role key)
ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;
-- No policies = only service_role can access

-- Updated_at trigger
CREATE TRIGGER update_customer_accounts_updated_at
  BEFORE UPDATE ON public.customer_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. saved_outfits table
CREATE TABLE public.saved_outfits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_account_id UUID NOT NULL REFERENCES public.customer_accounts(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  outfit_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_outfits ENABLE ROW LEVEL SECURITY;
-- No policies = only service_role can access

-- 3. Allow anonymous/public SELECT on products scoped by brand_id (for widget)
CREATE POLICY "Widget can view products by brand_id"
  ON public.products
  FOR SELECT
  USING (true);
