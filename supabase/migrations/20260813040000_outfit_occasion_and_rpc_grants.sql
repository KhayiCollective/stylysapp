-- Adds an `occasion` column to `outfits` so the AI's per-outfit occasion
-- suggestion (already generated in widget-outfits/generate-outfits, but
-- previously dropped on insert) can be persisted and used for real
-- analytics (Dashboard's "Outfit Categories" breakdown).
ALTER TABLE public.outfits ADD COLUMN IF NOT EXISTS occasion TEXT;

-- Closes a gap flagged (but never actioned) in the widget_events migration:
-- these SECURITY DEFINER functions were left with default PUBLIC EXECUTE,
-- meaning any anon/authenticated caller could invoke
-- supabase.rpc('increment_outfit_views', { p_outfit_id }) directly and
-- inflate any outfit's counters, bypassing the /event endpoint's brand
-- resolution entirely. Only the widget-outfits edge function (service_role)
-- needs to call these.
REVOKE EXECUTE ON FUNCTION public.increment_outfit_views(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_outfit_conversions(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_outfit_views(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_outfit_conversions(UUID) TO service_role;
