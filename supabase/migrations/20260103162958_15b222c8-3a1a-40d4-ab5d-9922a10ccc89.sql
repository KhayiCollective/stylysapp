-- Fix profiles_broad_access: Restrict profile access to own profile + admins/owners
-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view profiles in their brand" ON public.profiles;

-- Create policy for users to view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND id = auth.uid());

-- Create policy for admins/owners to view all profiles in their brand
CREATE POLICY "Admins can view all brand profiles" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND brand_id = get_user_brand_id(auth.uid()) 
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'))
);