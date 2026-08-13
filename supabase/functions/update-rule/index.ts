import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { verifyShopifySessionToken } from "../_shared/shopify-session-token.ts";

// Updates a row in `rules` (enabled and/or config) on behalf of the caller's
// brand. Exists because the client previously called
// `supabase.from("rules").update(...)` directly from the browser, which only
// ever worked for standalone (Supabase-authenticated) users — embedded
// Shopify admin callers use the anon key with no Supabase auth session, and
// the `rules` table has no anon UPDATE grant, so the write was silently
// rejected by Postgres every time. Settings appeared to save, then reverted
// on the next fetch. This function uses the service role key to perform the
// write server-side after verifying the caller (Shopify session token or
// Supabase auth) actually owns the brand the rule belongs to.

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

    const body = await req.json();
    const { rule_id, enabled, config } = body ?? {};

    if (!rule_id || typeof rule_id !== "string") {
      return new Response(JSON.stringify({ error: "rule_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (enabled === undefined && config === undefined) {
      return new Response(JSON.stringify({ error: "Provide enabled and/or config to update" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the rule actually belongs to this caller's brand before writing —
    // prevents an authenticated-but-wrong-brand caller from editing someone
    // else's rules by guessing a rule_id.
    const { data: existingRule, error: fetchError } = await supabase
      .from("rules")
      .select("id, brand_id")
      .eq("id", rule_id)
      .single();

    if (fetchError || !existingRule) {
      return new Response(JSON.stringify({ error: "Rule not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (existingRule.brand_id !== brandId) {
      return new Response(JSON.stringify({ error: "Rule does not belong to this brand" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updates: Record<string, unknown> = {};
    if (enabled !== undefined) updates.enabled = enabled;
    if (config !== undefined) updates.config = config;

    const { error: updateError } = await supabase
      .from("rules")
      .update(updates)
      .eq("id", rule_id);

    if (updateError) {
      console.error("[UPDATE-RULE] Update failed:", updateError.message);
      return new Response(JSON.stringify({ error: "Failed to update rule" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[UPDATE-RULE] Unexpected error:", error instanceof Error ? error.message : "Unknown");
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
