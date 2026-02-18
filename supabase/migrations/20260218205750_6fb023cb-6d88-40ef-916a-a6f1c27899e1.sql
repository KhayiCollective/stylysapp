-- Add photo_url column to customer_accounts
ALTER TABLE public.customer_accounts ADD COLUMN photo_url TEXT;

-- Create customer-photos storage bucket (public)
INSERT INTO storage.buckets (id, name, public) VALUES ('customer-photos', 'customer-photos', true);

-- Allow public read access to customer-photos
CREATE POLICY "Anyone can view customer photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'customer-photos');

-- Allow service role to upload (edge function uses service role)
CREATE POLICY "Service role can upload customer photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'customer-photos');

-- Allow service role to update customer photos
CREATE POLICY "Service role can update customer photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'customer-photos');

-- Allow service role to delete customer photos
CREATE POLICY "Service role can delete customer photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'customer-photos');