-- Onboarding progress tracking
CREATE TABLE public.onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  current_step INTEGER DEFAULT 1,
  completed_steps INTEGER[] DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(brand_id)
);

-- Support tickets
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- RLS policies for onboarding_progress
CREATE POLICY "Users can view their brand's onboarding progress"
ON public.onboarding_progress FOR SELECT
USING (brand_id = get_user_brand_id(auth.uid()));

CREATE POLICY "Users can insert their brand's onboarding progress"
ON public.onboarding_progress FOR INSERT
WITH CHECK (brand_id = get_user_brand_id(auth.uid()));

CREATE POLICY "Users can update their brand's onboarding progress"
ON public.onboarding_progress FOR UPDATE
USING (brand_id = get_user_brand_id(auth.uid()));

-- RLS policies for support_tickets
CREATE POLICY "Users can view their brand's support tickets"
ON public.support_tickets FOR SELECT
USING (brand_id = get_user_brand_id(auth.uid()));

CREATE POLICY "Users can insert support tickets"
ON public.support_tickets FOR INSERT
WITH CHECK (brand_id = get_user_brand_id(auth.uid()));

-- Update trigger for onboarding_progress
CREATE TRIGGER update_onboarding_progress_updated_at
BEFORE UPDATE ON public.onboarding_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();