-- Drop and recreate the view to ensure proper security
DROP VIEW IF EXISTS public.customer_summary;

-- Create view with security_invoker to inherit RLS from the underlying customers table
CREATE VIEW public.customer_summary 
WITH (security_invoker = on)
AS
SELECT 
  id,
  brand_id,
  CASE 
    WHEN email IS NULL THEN NULL
    ELSE CONCAT(LEFT(email, 1), '***@', SPLIT_PART(email, '@', 2))
  END as masked_email,
  body_shape,
  quiz_completed_at,
  created_at,
  updated_at
FROM public.customers;

-- Grant access to the view
GRANT SELECT ON public.customer_summary TO authenticated;