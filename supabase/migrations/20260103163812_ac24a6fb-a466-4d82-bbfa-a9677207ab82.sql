-- Drop the SECURITY DEFINER view and recreate with SECURITY INVOKER
DROP VIEW IF EXISTS public.profile_summary;

-- Recreate view with explicit SECURITY INVOKER (respects caller's permissions)
CREATE VIEW public.profile_summary 
WITH (security_invoker = true)
AS
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