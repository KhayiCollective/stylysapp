import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { verifyShopifySessionToken } from "../_shared/shopify-session-token.ts";
import { buildDefaultRules } from "../_shared/default-rules.ts";

// Self-heals brands that were created without a default rule set — notably,
// every brand created through the Shopify embedded OAuth install (the real
// App Store install path) never had rules seeded at all, so their Rules page
// rendered empty Styling/Inventory/Pricing sections and no Outfit Composition
// card. Rather than requiring a reinstall or a one-off DB fix per affected
// brand, the Rules page calls this on load whenever it finds zero rules, and
// this backfills the full default set (and default widget_config, if
// missing) for that brand. Safe to call repeatedly — it's a no-op once rules
// already exist.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-shopify-session-token",
};

const SHOPIFY_CLIENT_ID = Deno.env.get("SHOPIFY_CLIENT_ID") || "";
const SHOPIFY_CLIENT_SECRET = Deno.env.get("SHOPIFY_CLIENT_SECRET") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
        return new Response(JSON.stringify({ error: "Invalid session token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "No authorization header provided" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData.user) {
        return new Response(JSON.stringify({ error: "Authentication error" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("brand_id")
        .eq("id", userData.user.id)
        .single();
      if (!profile?.brand_id) {
        return new Response(JSON.stringify({ error: "No brand found for user" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      brandId = profile.brand_id;
    }

    // Rules: only seed if this brand truly has none yet.
    const { data: existingRules, error: rulesCheckError } = await supabase
      .from("rules")
      .select("id")
      .eq("brand_id", brandId)
      .limit(1);

    if (rulesCheckError) {
      console.error("[ENSURE-DEFAULT-RULES] Failed to check existing rules:", rulesCheckError.message);
      return new Response(JSON.stringify({ error: "Failed to check existing rules" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let seededRules = false;
    if (!existingRules || existingRules.length === 0) {
      const { error: insertError } = await supabase
        .from("rules")
        .insert(buildDefaultRules(brandId));

      if (insertError) {
        console.error("[ENSURE-DEFAULT-RULES] Failed to seed default rules:", insertError.message);
        return new Response(JSON.stringify({ error: "Failed to seed default rules" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      seededRules = true;
    }

    // widget_config: same gap exists here (shopify-oauth never creates one),
    // so backfill it too while we're already resolving this brand.
    const { data: existingConfig } = await supabase
      .from("widget_config")
      .select("id")
      .eq("brand_id", brandId)
      .maybeSingle();

    let seededWidgetConfig = false;
    if (!existingConfig) {
      const { error: configError } = await supabase
        .from("widget_config")
        .insert({ brand_id: brandId });
      if (configError) {
        // Non-fatal — rules are the thing the Rules page actually needs.
        console.error("[ENSURE-DEFAULT-RULES] Failed to seed widget_config:", configError.message);
      } else {
        seededWidgetConfig = true;
      }
    }

    return new Response(
      JSON.stringify({ success: true, seededRules, seededWidgetConfig }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[ENSURE-DEFAULT-RULES] Unexpected error:", error instanceof Error ? error.message : "Unknown");
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
