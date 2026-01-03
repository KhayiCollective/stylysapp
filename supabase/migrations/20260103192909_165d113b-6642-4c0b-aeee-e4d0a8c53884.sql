-- Fix customer_summary view to use SECURITY INVOKER
DROP VIEW IF EXISTS public.customer_summary;

CREATE VIEW public.customer_summary 
WITH (security_invoker = true)
AS
SELECT 
  id,
  brand_id,
  quiz_completed_at,
  created_at,
  updated_at,
  CASE 
    WHEN email IS NOT NULL AND email LIKE '%@%' THEN
      LEFT(email, 1) || '***@' || SPLIT_PART(email, '@', 2)
    ELSE NULL
  END AS masked_email,
  body_shape
FROM public.customers;

-- Grant access to authenticated users (views respect underlying table RLS)
GRANT SELECT ON public.customer_summary TO authenticated;