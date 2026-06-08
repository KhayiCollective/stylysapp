
-- Fix has_role to use the parameter instead of auth.uid()
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Add missing UPDATE policy on outfit_items
CREATE POLICY "Brand members can update their outfit items"
ON public.outfit_items
FOR UPDATE
USING (outfit_id IN (SELECT id FROM public.outfits WHERE brand_id = public.get_user_brand_id(auth.uid())))
WITH CHECK (outfit_id IN (SELECT id FROM public.outfits WHERE brand_id = public.get_user_brand_id(auth.uid())));

-- Add missing UPDATE and DELETE policies on support_tickets
CREATE POLICY "Brand members can update their support tickets"
ON public.support_tickets
FOR UPDATE
USING (brand_id = public.get_user_brand_id(auth.uid()))
WITH CHECK (brand_id = public.get_user_brand_id(auth.uid()));

CREATE POLICY "Brand owners can delete their support tickets"
ON public.support_tickets
FOR DELETE
USING (brand_id = public.get_user_brand_id(auth.uid()) AND public.has_role(auth.uid(), 'owner'));
