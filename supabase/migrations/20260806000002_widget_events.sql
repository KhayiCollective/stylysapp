-- widget_events: timestamped log of view/conversion events per outfit
-- outfit_id FK to outfits(id) is valid because generate now persists rows first
CREATE TABLE public.widget_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,
  outfit_id UUID REFERENCES public.outfits(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'conversion')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_widget_events_brand_occurred_at ON public.widget_events(brand_id, occurred_at);
CREATE INDEX idx_widget_events_brand_event_type  ON public.widget_events(brand_id, event_type);

ALTER TABLE public.widget_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brands can view their own widget events"
  ON public.widget_events FOR SELECT
  USING (brand_id IN (SELECT brand_id FROM public.profiles WHERE id = auth.uid()));

-- Atomic increment helpers called by the /event endpoint (service-role context only).
-- TODO: REVOKE EXECUTE ON FUNCTION increment_outfit_views, increment_outfit_conversions
--       FROM PUBLIC; GRANT EXECUTE TO service_role only — prevents anon RPC calls.
CREATE OR REPLACE FUNCTION public.increment_outfit_views(p_outfit_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.outfits SET views = views + 1 WHERE id = p_outfit_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_outfit_conversions(p_outfit_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.outfits SET conversions = conversions + 1 WHERE id = p_outfit_id;
$$;
