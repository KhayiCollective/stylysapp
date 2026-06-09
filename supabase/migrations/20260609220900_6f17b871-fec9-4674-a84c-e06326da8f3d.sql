
-- Restrict saved_outfits writes to service role only (customer-facing edge functions)
CREATE POLICY "Block authenticated inserts on saved_outfits"
  ON public.saved_outfits FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "Block authenticated updates on saved_outfits"
  ON public.saved_outfits FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Block authenticated deletes on saved_outfits"
  ON public.saved_outfits FOR DELETE TO authenticated
  USING (false);

-- Tighten support_tickets INSERT to require an authenticated user with a brand
DROP POLICY "Users can insert support tickets" ON public.support_tickets;

CREATE POLICY "Authenticated users can insert support tickets"
  ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND brand_id IS NOT NULL
    AND brand_id = get_user_brand_id(auth.uid())
  );
