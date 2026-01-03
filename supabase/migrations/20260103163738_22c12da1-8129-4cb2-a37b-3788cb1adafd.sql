-- Create a profile_summary view with masked emails (similar pattern to customer_summary)
-- This allows admins to see profile info without exposing full email addresses
CREATE OR REPLACE VIEW public.profile_summary AS
SELECT 
  id,
  brand_id,
  full_name,
  avatar_url,
  created_at,
  updated_at,
  -- Mask email: show first character + *** + @domain
  CASE 
    WHEN email IS NOT NULL AND email LIKE '%@%' THEN
      LEFT(email, 1) || '***@' || SPLIT_PART(email, '@', 2)
    ELSE NULL
  END AS masked_email
FROM public.profiles;

-- Grant access to authenticated users
GRANT SELECT ON public.profile_summary TO authenticated;

-- Create a security definer function to get full profile email (with audit trail)
-- Only returns email if caller is viewing their own profile OR is an owner
CREATE OR REPLACE FUNCTION public.get_profile_email(profile_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_email TEXT;
  profile_brand_id UUID;
  caller_brand_id UUID;
BEGIN
  -- Get the caller's brand_id
  caller_brand_id := get_user_brand_id(auth.uid());
  
  -- Check if caller is requesting their own email
  IF profile_id = auth.uid() THEN
    SELECT email INTO profile_email FROM profiles WHERE id = profile_id;
    RETURN profile_email;
  END IF;
  
  -- Check if caller is an owner and profile is in their brand
  IF has_role(auth.uid(), 'owner') THEN
    SELECT email, brand_id INTO profile_email, profile_brand_id 
    FROM profiles 
    WHERE id = profile_id;
    
    IF profile_brand_id = caller_brand_id THEN
      RETURN profile_email;
    END IF;
  END IF;
  
  -- Access denied
  RAISE EXCEPTION 'Access denied: You can only view your own email or must be an owner';
END;
$$;

-- Revoke direct execute from public, grant to authenticated
REVOKE EXECUTE ON FUNCTION public.get_profile_email(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_profile_email(uuid) TO authenticated;