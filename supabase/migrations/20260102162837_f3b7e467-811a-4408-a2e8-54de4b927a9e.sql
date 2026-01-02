-- Create sync_history table to track sync operations
CREATE TABLE public.sync_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL, -- 'manual', 'webhook', 'initial'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
  products_created INTEGER DEFAULT 0,
  products_updated INTEGER DEFAULT 0,
  products_deleted INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.sync_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view sync history in their brand"
ON public.sync_history
FOR SELECT
USING (brand_id = get_user_brand_id(auth.uid()));

CREATE POLICY "Users can insert sync history in their brand"
ON public.sync_history
FOR INSERT
WITH CHECK (brand_id = get_user_brand_id(auth.uid()));

-- Add indexes
CREATE INDEX idx_sync_history_brand_id ON public.sync_history(brand_id);
CREATE INDEX idx_sync_history_started_at ON public.sync_history(started_at DESC);

-- Add tags column to products table for bulk tagging
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Create index for tags
CREATE INDEX idx_products_tags ON public.products USING GIN(tags);