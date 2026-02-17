
-- Enable RLS on saved_outfits
ALTER TABLE public.saved_outfits ENABLE ROW LEVEL SECURITY;

-- Merchants can view saved outfits for their brand
CREATE POLICY "Merchants can view saved outfits in their brand"
ON public.saved_outfits
FOR SELECT
USING (brand_id = get_user_brand_id(auth.uid()));

-- Allow anonymous insert for widget (customer saves via edge function with service role)
-- No additional insert policy needed since edge functions use service role key
