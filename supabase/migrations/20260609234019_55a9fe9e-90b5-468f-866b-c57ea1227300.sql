
DELETE FROM public.brands WHERE id = '0c51eb82-556a-48f3-9656-a41407944a39';

CREATE TABLE IF NOT EXISTS public.customer_password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id UUID NOT NULL REFERENCES public.customer_accounts(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_password_resets_token_hash_idx ON public.customer_password_resets(token_hash);
CREATE INDEX IF NOT EXISTS customer_password_resets_account_idx ON public.customer_password_resets(customer_account_id);

GRANT ALL ON public.customer_password_resets TO service_role;

ALTER TABLE public.customer_password_resets ENABLE ROW LEVEL SECURITY;

-- No public/authenticated policies — only the service role (edge functions) touches this table.
