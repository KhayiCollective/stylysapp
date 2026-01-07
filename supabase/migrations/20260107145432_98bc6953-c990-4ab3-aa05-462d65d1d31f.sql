-- Harden get_user_brand_id to only work for auth.uid()
CREATE OR REPLACE FUNCTION public.get_user_brand_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT brand_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Harden has_role to only work for auth.uid()
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = _role
  )
$$;

-- Grant execute privileges to authenticated and anon roles
GRANT EXECUTE ON FUNCTION public.get_user_brand_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_brand_id(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon;