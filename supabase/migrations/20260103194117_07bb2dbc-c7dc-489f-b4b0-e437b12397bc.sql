-- Fix 1: Revoke direct EXECUTE permissions on vulnerable security definer functions
-- These functions are designed to be called within RLS policies (with auth.uid()),
-- not directly by end users. Revoking public/authenticated access prevents misuse.

-- Revoke execute from public (anonymous)
REVOKE EXECUTE ON FUNCTION public.get_user_brand_id(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM public;

-- Revoke execute from authenticated users (they can still use these via RLS policies)
REVOKE EXECUTE ON FUNCTION public.get_user_brand_id(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated;

-- Also revoke from anon role for completeness
REVOKE EXECUTE ON FUNCTION public.get_user_brand_id(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;

-- Fix 2: Drop and recreate customer_summary view with a secure approach
-- Create a secure function that enforces brand isolation directly

-- First drop the existing view
DROP VIEW IF EXISTS public.customer_summary;

-- Create secure function that enforces brand membership
CREATE OR REPLACE FUNCTION public.get_customer_summaries()
RETURNS TABLE (
  id UUID,
  brand_id UUID,
  masked_email TEXT,
  body_shape TEXT,
  quiz_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT 
    c.id,
    c.brand_id,
    CASE 
      WHEN c.email IS NULL THEN NULL
      ELSE CONCAT(LEFT(c.email, 1), '***@', SPLIT_PART(c.email, '@', 2))
    END as masked_email,
    c.body_shape,
    c.quiz_completed_at,
    c.created_at,
    c.updated_at
  FROM customers c
  WHERE c.brand_id = get_user_brand_id(auth.uid())
    AND auth.uid() IS NOT NULL;
$$;

-- Grant execute to authenticated users only
GRANT EXECUTE ON FUNCTION public.get_customer_summaries() TO authenticated;

-- Recreate the view for backward compatibility, but it now just calls the function
CREATE VIEW public.customer_summary 
WITH (security_invoker = on)
AS SELECT * FROM get_customer_summaries();

-- Grant select on the view to authenticated
GRANT SELECT ON public.customer_summary TO authenticated;