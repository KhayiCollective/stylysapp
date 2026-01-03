-- Drop the existing SELECT policy on customers
DROP POLICY IF EXISTS "Users can view customers in their brand" ON public.customers;

-- Create new policy that explicitly requires authentication AND brand membership
CREATE POLICY "Users can view customers in their brand" 
ON public.customers 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND brand_id = get_user_brand_id(auth.uid()));