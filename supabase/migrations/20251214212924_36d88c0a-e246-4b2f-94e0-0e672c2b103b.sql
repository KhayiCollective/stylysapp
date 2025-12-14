
-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'owner', 'member');

-- Create brands table (multi-tenant accounts)
CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create profiles table (users linked to brands)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'member',
  UNIQUE (user_id, role)
);

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT,
  category TEXT NOT NULL,
  color TEXT,
  fit TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  inventory_status TEXT NOT NULL DEFAULT 'in_stock',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create outfits table
CREATE TABLE public.outfits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  name TEXT,
  anchor_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  total_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create outfit_items table (products in each outfit)
CREATE TABLE public.outfit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outfit_id UUID REFERENCES public.outfits(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create rules table (configurable rules per brand)
CREATE TABLE public.rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_profiles_brand_id ON public.profiles(brand_id);
CREATE INDEX idx_products_brand_id ON public.products(brand_id);
CREATE INDEX idx_outfits_brand_id ON public.outfits(brand_id);
CREATE INDEX idx_outfit_items_outfit_id ON public.outfit_items(outfit_id);
CREATE INDEX idx_rules_brand_id ON public.rules(brand_id);

-- Enable RLS on all tables
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outfit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rules ENABLE ROW LEVEL SECURITY;

-- Security definer function to get user's brand_id
CREATE OR REPLACE FUNCTION public.get_user_brand_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT brand_id FROM public.profiles WHERE id = _user_id
$$;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS Policies for brands
CREATE POLICY "Users can view their own brand"
  ON public.brands FOR SELECT
  USING (id = public.get_user_brand_id(auth.uid()));

CREATE POLICY "Owners can update their brand"
  ON public.brands FOR UPDATE
  USING (id = public.get_user_brand_id(auth.uid()) AND public.has_role(auth.uid(), 'owner'));

-- RLS Policies for profiles
CREATE POLICY "Users can view profiles in their brand"
  ON public.profiles FOR SELECT
  USING (brand_id = public.get_user_brand_id(auth.uid()));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policies for products
CREATE POLICY "Users can view products in their brand"
  ON public.products FOR SELECT
  USING (brand_id = public.get_user_brand_id(auth.uid()));

CREATE POLICY "Users can insert products in their brand"
  ON public.products FOR INSERT
  WITH CHECK (brand_id = public.get_user_brand_id(auth.uid()));

CREATE POLICY "Users can update products in their brand"
  ON public.products FOR UPDATE
  USING (brand_id = public.get_user_brand_id(auth.uid()));

CREATE POLICY "Users can delete products in their brand"
  ON public.products FOR DELETE
  USING (brand_id = public.get_user_brand_id(auth.uid()));

-- RLS Policies for outfits
CREATE POLICY "Users can view outfits in their brand"
  ON public.outfits FOR SELECT
  USING (brand_id = public.get_user_brand_id(auth.uid()));

CREATE POLICY "Users can insert outfits in their brand"
  ON public.outfits FOR INSERT
  WITH CHECK (brand_id = public.get_user_brand_id(auth.uid()));

CREATE POLICY "Users can update outfits in their brand"
  ON public.outfits FOR UPDATE
  USING (brand_id = public.get_user_brand_id(auth.uid()));

CREATE POLICY "Users can delete outfits in their brand"
  ON public.outfits FOR DELETE
  USING (brand_id = public.get_user_brand_id(auth.uid()));

-- RLS Policies for outfit_items
CREATE POLICY "Users can view outfit_items in their brand"
  ON public.outfit_items FOR SELECT
  USING (
    outfit_id IN (
      SELECT id FROM public.outfits 
      WHERE brand_id = public.get_user_brand_id(auth.uid())
    )
  );

CREATE POLICY "Users can insert outfit_items in their brand"
  ON public.outfit_items FOR INSERT
  WITH CHECK (
    outfit_id IN (
      SELECT id FROM public.outfits 
      WHERE brand_id = public.get_user_brand_id(auth.uid())
    )
  );

CREATE POLICY "Users can delete outfit_items in their brand"
  ON public.outfit_items FOR DELETE
  USING (
    outfit_id IN (
      SELECT id FROM public.outfits 
      WHERE brand_id = public.get_user_brand_id(auth.uid())
    )
  );

-- RLS Policies for rules
CREATE POLICY "Users can view rules in their brand"
  ON public.rules FOR SELECT
  USING (brand_id = public.get_user_brand_id(auth.uid()));

CREATE POLICY "Users can update rules in their brand"
  ON public.rules FOR UPDATE
  USING (brand_id = public.get_user_brand_id(auth.uid()));

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_outfits_updated_at BEFORE UPDATE ON public.outfits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rules_updated_at BEFORE UPDATE ON public.rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
