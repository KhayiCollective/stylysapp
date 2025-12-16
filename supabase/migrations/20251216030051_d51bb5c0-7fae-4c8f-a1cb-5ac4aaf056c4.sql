-- Create customers table for end shoppers who take the style quiz
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  email TEXT,
  external_id TEXT, -- Shopify customer ID or similar
  
  -- Style Quiz Data
  style_preferences JSONB DEFAULT '{}', -- casual, formal, bohemian, etc.
  body_shape TEXT, -- hourglass, pear, apple, rectangle, etc.
  preferred_colors JSONB DEFAULT '[]', -- array of colors they like
  avoided_colors JSONB DEFAULT '[]', -- colors to avoid
  size_info JSONB DEFAULT '{}', -- top size, bottom size, etc.
  occasions JSONB DEFAULT '[]', -- work, casual, date night, etc.
  budget_range JSONB DEFAULT '{}', -- min/max price preferences
  
  quiz_completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(brand_id, email),
  UNIQUE(brand_id, external_id)
);

-- Create recommendations table for AI-generated outfit suggestions
CREATE TABLE public.recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  outfit_id UUID REFERENCES public.outfits(id) ON DELETE SET NULL,
  
  occasion TEXT, -- what occasion this was recommended for
  reason TEXT, -- why AI recommended this
  
  -- Tracking
  viewed_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  added_to_cart_at TIMESTAMP WITH TIME ZONE,
  purchased_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create widget_config table for brand's embeddable widget settings
CREATE TABLE public.widget_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE UNIQUE,
  
  -- Appearance
  primary_color TEXT DEFAULT '#000000',
  secondary_color TEXT DEFAULT '#ffffff',
  font_family TEXT DEFAULT 'inherit',
  border_radius TEXT DEFAULT '8px',
  
  -- Quiz configuration
  quiz_enabled BOOLEAN DEFAULT true,
  quiz_questions JSONB DEFAULT '[]', -- custom questions
  
  -- Behavior
  show_prices BOOLEAN DEFAULT true,
  max_recommendations INTEGER DEFAULT 3,
  
  -- Integration
  cart_integration_type TEXT DEFAULT 'redirect', -- redirect, api, custom
  cart_api_endpoint TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.widget_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers (brand can only see their customers)
CREATE POLICY "Users can view customers in their brand"
  ON public.customers FOR SELECT
  USING (brand_id = get_user_brand_id(auth.uid()));

CREATE POLICY "Users can insert customers in their brand"
  ON public.customers FOR INSERT
  WITH CHECK (brand_id = get_user_brand_id(auth.uid()));

CREATE POLICY "Users can update customers in their brand"
  ON public.customers FOR UPDATE
  USING (brand_id = get_user_brand_id(auth.uid()));

CREATE POLICY "Users can delete customers in their brand"
  ON public.customers FOR DELETE
  USING (brand_id = get_user_brand_id(auth.uid()));

-- RLS Policies for recommendations
CREATE POLICY "Users can view recommendations in their brand"
  ON public.recommendations FOR SELECT
  USING (brand_id = get_user_brand_id(auth.uid()));

CREATE POLICY "Users can insert recommendations in their brand"
  ON public.recommendations FOR INSERT
  WITH CHECK (brand_id = get_user_brand_id(auth.uid()));

CREATE POLICY "Users can update recommendations in their brand"
  ON public.recommendations FOR UPDATE
  USING (brand_id = get_user_brand_id(auth.uid()));

CREATE POLICY "Users can delete recommendations in their brand"
  ON public.recommendations FOR DELETE
  USING (brand_id = get_user_brand_id(auth.uid()));

-- RLS Policies for widget_config
CREATE POLICY "Users can view their brand's widget config"
  ON public.widget_config FOR SELECT
  USING (brand_id = get_user_brand_id(auth.uid()));

CREATE POLICY "Users can insert their brand's widget config"
  ON public.widget_config FOR INSERT
  WITH CHECK (brand_id = get_user_brand_id(auth.uid()));

CREATE POLICY "Users can update their brand's widget config"
  ON public.widget_config FOR UPDATE
  USING (brand_id = get_user_brand_id(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_widget_config_updated_at
  BEFORE UPDATE ON public.widget_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();