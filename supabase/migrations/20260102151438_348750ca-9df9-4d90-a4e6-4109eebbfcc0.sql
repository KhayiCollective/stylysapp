-- Create masked email view for customer displays
CREATE OR REPLACE VIEW public.customer_summary AS
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

-- Create audit function for email access logging
CREATE OR REPLACE FUNCTION public.get_customer_email(customer_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  customer_email TEXT;
  user_brand_id UUID;
BEGIN
  -- Get the user's brand_id
  user_brand_id := get_user_brand_id(auth.uid());
  
  -- Only return email if customer belongs to user's brand
  SELECT email INTO customer_email 
  FROM customers 
  WHERE id = customer_id 
    AND brand_id = user_brand_id;
  
  IF customer_email IS NULL THEN
    RAISE EXCEPTION 'Customer not found or access denied';
  END IF;
  
  RETURN customer_email;
END;
$$;

-- Revoke direct function execution from public, only authenticated users
REVOKE ALL ON FUNCTION public.get_customer_email(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_email(UUID) TO authenticated;