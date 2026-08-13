import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { verifyShopifySessionToken } from "../_shared/shopify-session-token.ts";

// Serves all Dashboard.tsx analytics in one brand-scoped, service-role call.
//
// Why this exists instead of the dashboard querying `outfits`/`products`/
// `customers`/`widget_events` directly from the client: those tables' RLS
// policies are scoped to `auth.uid()` (a real Supabase Auth session), but the
// embedded Shopify Admin dashboard never signs into Supabase Auth — it only
// resolves a brand_id client-side via an anon-role lookup (see
// EmbeddedAppProvider.tsx). For tables with no anon SELECT policy (outfits,
// customers, widget_events), that means embedded merchants got zero rows
// back, not just unfiltered ones. For `products`, which does have an open
// anon SELECT policy for the customer-facing widget's benefit, an unfiltered
// client query would have returned every brand's product count, not just
// this merchant's. This function uses the same dual-auth + service-role
// pattern as update-rule/check-subscription: resolve the caller's brand
// first, then query with the service role (bypassing RLS) scoped to exactly
// that brand_id.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-shopify-session-token",
};

const SHOPIFY_CLIENT_ID = Deno.env.get("SHOPIFY_CLIENT_ID") || "";
const SHOPIFY_CLIENT_SECRET = Deno.env.get("SHOPIFY_CLIENT_SECRET") || "";

// Occasion strings are free-text from the AI ("Brunch", "brunch", "Weekend
// Getaway", ...) — bucket into a small set of display categories so the
// donut chart doesn't fragment into a dozen near-duplicate slivers.
function bucketOccasion(raw: string | null): string {
  if (!raw) return "Everyday";
  const o = raw.toLowerCase();
  if (/workout|gym|active/.test(o)) return "Workout";
  if (/work|office|meeting/.test(o)) return "Work";
  if (/date|evening|dinner/.test(o)) return "Evening";
  if (/special|event|holiday|formal|wedding/.test(o)) return "Special Event";
  if (/travel|getaway|vacation/.test(o)) return "Travel";
  if (/weekend|brunch|casual|everyday/.test(o)) return "Casual";
  return "Casual";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Resolve brand_id: verified Shopify session token (embedded) or Supabase auth (standalone)
    let brandId: string;
    const shopifySessionToken = req.headers.get("X-Shopify-Session-Token");

    if (shopifySessionToken) {
      try {
        const { brandId: resolvedBrandId } = await verifyShopifySessionToken(
          shopifySessionToken,
          supabase,
          SHOPIFY_CLIENT_ID,
          SHOPIFY_CLIENT_SECRET,
        );
        brandId = resolvedBrandId;
      } catch (err) {
        return json({ error: `Invalid session token: ${err instanceof Error ? err.message : String(err)}` }, 401);
      }
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json({ error: "No authorization header provided" }, 401);
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData.user) return json({ error: "Authentication error" }, 401);
      const { data: profile } = await supabase
        .from("profiles")
        .select("brand_id")
        .eq("id", userData.user.id)
        .single();
      if (!profile?.brand_id) return json({ error: "No brand found for user" }, 400);
      brandId = profile.brand_id;
    }

    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();

    const [outfitsResult, productsResult, customersResult, eventsResult] = await Promise.all([
      supabase
        .from("outfits")
        .select("id, name, views, conversions, total_price, occasion, created_at")
        .eq("brand_id", brandId),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", brandId),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", brandId),
      // Pull 14 days so we can compute a real week-over-week comparison
      // (this week vs. the 7 days before it), not just a single week total.
      supabase
        .from("widget_events")
        .select("event_type, occurred_at")
        .eq("brand_id", brandId)
        .gte("occurred_at", fourteenDaysAgo),
    ]);

    if (outfitsResult.error) throw outfitsResult.error;
    if (productsResult.error) throw productsResult.error;
    if (customersResult.error) throw customersResult.error;
    if (eventsResult.error) throw eventsResult.error;

    const outfits = outfitsResult.data || [];
    const events = eventsResult.data || [];

    const totalOutfits = outfits.length;
    const totalViews = outfits.reduce((s, o) => s + (o.views || 0), 0);
    const totalConversions = outfits.reduce((s, o) => s + (o.conversions || 0), 0);
    const totalRevenue = outfits.reduce((s, o) => s + (o.conversions || 0) * Number(o.total_price || 0), 0);

    // Week-over-week trends. Views/Conversions come from widget_events, split
    // into "this week" (last 7 days) vs. "prior week" (7-14 days ago) — a real
    // comparison instead of the fabricated "+12%/+23%" badges the dashboard
    // used to show. Total Outfits uses outfits.created_at the same way. Est.
    // Revenue has no reliable time-series basis (it's derived from lifetime
    // conversions x current price), so we don't fabricate a trend for it —
    // the client just omits that badge.
    const pctChange = (current: number, prior: number): number | null => {
      if (prior === 0) return current > 0 ? 100 : null;
      return Math.round(((current - prior) / prior) * 100);
    };

    let viewsThisWeek = 0, viewsPriorWeek = 0, conversionsThisWeek = 0, conversionsPriorWeek = 0;
    for (const e of events) {
      const t = new Date(e.occurred_at || "").getTime();
      if (Number.isNaN(t)) continue;
      const isThisWeek = t >= new Date(sevenDaysAgo).getTime();
      if (e.event_type === "view") {
        if (isThisWeek) viewsThisWeek++; else viewsPriorWeek++;
      } else if (e.event_type === "conversion") {
        if (isThisWeek) conversionsThisWeek++; else conversionsPriorWeek++;
      }
    }

    let outfitsThisWeek = 0, outfitsPriorWeek = 0;
    for (const o of outfits) {
      const t = new Date(o.created_at || "").getTime();
      if (Number.isNaN(t)) continue;
      if (t >= new Date(sevenDaysAgo).getTime()) outfitsThisWeek++;
      else if (t >= new Date(fourteenDaysAgo).getTime()) outfitsPriorWeek++;
    }

    const trends = {
      totalOutfits: pctChange(outfitsThisWeek, outfitsPriorWeek),
      totalViews: pctChange(viewsThisWeek, viewsPriorWeek),
      totalConversions: pctChange(conversionsThisWeek, conversionsPriorWeek),
      totalRevenue: null as number | null,
    };

    const topOutfits = [...outfits]
      .sort((a, b) => (b.conversions || 0) - (a.conversions || 0))
      .slice(0, 5)
      .map((o) => ({ id: o.id, name: o.name, views: o.views || 0, conversions: o.conversions || 0 }));

    // Category breakdown: bucket every outfit's occasion, express as % of outfits.
    const categoryCounts = new Map<string, number>();
    for (const o of outfits) {
      const bucket = bucketOccasion(o.occasion);
      categoryCounts.set(bucket, (categoryCounts.get(bucket) || 0) + 1);
    }
    const categoryBreakdown = Array.from(categoryCounts.entries())
      .map(([name, count]) => ({ name, count, value: totalOutfits > 0 ? Math.round((count / totalOutfits) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);

    // Weekly performance: last 7 calendar days (UTC), oldest first, bucketed
    // from real widget_events rows (view/conversion), not outfit totals —
    // outfits.views/conversions are lifetime counters with no date breakdown.
    const dayBuckets: { date: string; label: string; views: number; conversions: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      dayBuckets.push({
        date: dateKey,
        label: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
        views: 0,
        conversions: 0,
      });
    }
    const bucketByDate = new Map(dayBuckets.map((b) => [b.date, b]));
    for (const e of events) {
      const dateKey = (e.occurred_at || "").slice(0, 10);
      const bucket = bucketByDate.get(dateKey);
      if (!bucket) continue;
      if (e.event_type === "view") bucket.views++;
      else if (e.event_type === "conversion") bucket.conversions++;
    }

    return json({
      stats: {
        totalOutfits,
        totalViews,
        totalConversions,
        totalRevenue,
        productsCount: productsResult.count || 0,
        customersCount: customersResult.count || 0,
      },
      trends,
      topOutfits,
      categoryBreakdown,
      weeklyPerformance: dayBuckets.map(({ label, views, conversions }) => ({ name: label, views, conversions })),
    });
  } catch (error) {
    console.error("[dashboard-stats] error:", error instanceof Error ? error.message : error);
    return json({ error: "Internal error" }, 500);
  }
});
