-- Allow unauthenticated visitors (and merchants mid-onboarding with no brand_id yet)
-- to submit support tickets. The old policy blocked any insert where brand_id was
-- null because (null = null) evaluates to NULL, not TRUE, in PostgreSQL RLS.
DROP POLICY IF EXISTS "Users can insert support tickets" ON public.support_tickets;

CREATE POLICY "Users can insert support tickets"
ON public.support_tickets FOR INSERT
WITH CHECK (
  brand_id IS NULL
  OR brand_id = get_user_brand_id(auth.uid())
);
