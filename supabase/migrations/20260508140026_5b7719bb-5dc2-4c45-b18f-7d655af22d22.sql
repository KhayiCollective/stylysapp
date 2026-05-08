
-- Make customer-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'customer-photos';

-- Drop any public-read policies on customer-photos and add owner-scoped/service-only access.
-- (Service role bypasses RLS, so it can still write/read on behalf of authenticated widget customers.)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual ILIKE '%customer-photos%' OR with_check ILIKE '%customer-photos%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Add explicit deny-by-default for customer-photos (no public access; only service role via edge functions).
-- (No SELECT/INSERT/UPDATE/DELETE policy means RLS blocks all anon/authenticated access.)

-- Add deny-all RLS policies on customer_accounts so direct client access is blocked.
-- All access must go through edge functions using service role.
ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct client access to customer_accounts" ON public.customer_accounts;
CREATE POLICY "No direct client access to customer_accounts"
  ON public.customer_accounts
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);
