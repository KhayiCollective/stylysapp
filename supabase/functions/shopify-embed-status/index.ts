import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyShopifySessionToken } from "../_shared/shopify-session-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-shopify-session-token",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const SHOPIFY_CLIENT_ID = Deno.env.get("SHOPIFY_CLIENT_ID") || "";
const SHOPIFY_CLIENT_SECRET = Deno.env.get("SHOPIFY_CLIENT_SECRET") || "";

// uid from extensions/stylys-widget/shopify.extension.toml
const EMBED_BLOCK_UID = "1a56a68b-be49-a278-21b2-9e86191a1e00624a4835";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Resolve brand_id: verified session token (embedded) or request body (standalone)
    let brand_id: string;
    const sessionToken = req.headers.get("X-Shopify-Session-Token");

    if (sessionToken) {
      // Embedded path: verify the token cryptographically — body is never read
      try {
        const { brandId } = await verifyShopifySessionToken(
          sessionToken,
          supabase,
          SHOPIFY_CLIENT_ID,
          SHOPIFY_CLIENT_SECRET,
        );
        brand_id = brandId;
      } catch {
        return new Response(JSON.stringify({ error: "Invalid session token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Standalone path: read body exactly once
      try {
        const body = await req.json();
        brand_id = body.brand_id;
      } catch {
        return new Response(JSON.stringify({ error: "Invalid request body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!brand_id) {
        return new Response(JSON.stringify({ error: "brand_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("shopify_store_domain, shopify_access_token")
      .eq("id", brand_id)
      .single();

    if (brandError || !brand?.shopify_store_domain || !brand?.shopify_access_token) {
      return new Response(JSON.stringify({ error: "Brand not found or Shopify not connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { shopify_store_domain: shop, shopify_access_token: token } = brand;

    // Step 1: get the active (main) theme ID
    const themesResp = await fetch(
      `https://${shop}/admin/api/2025-01/themes.json?role=main`,
      { headers: { "X-Shopify-Access-Token": token } }
    );

    if (!themesResp.ok) {
      console.error("[SHOPIFY-EMBED-STATUS] Themes API failed:", themesResp.status);
      return new Response(JSON.stringify({ error: "Failed to fetch themes" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const themesData = await themesResp.json();
    const themeId = themesData.themes?.[0]?.id;

    if (!themeId) {
      return new Response(JSON.stringify({ error: "No active theme found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: fetch config/settings_data.json from the active theme
    const assetResp = await fetch(
      `https://${shop}/admin/api/2025-01/themes/${themeId}/assets.json?asset[key]=config/settings_data.json`,
      { headers: { "X-Shopify-Access-Token": token } }
    );

    if (!assetResp.ok) {
      console.error("[SHOPIFY-EMBED-STATUS] Asset API failed:", assetResp.status);
      return new Response(JSON.stringify({ error: "Failed to fetch theme settings" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const assetData = await assetResp.json();

    // asset.value is the raw JSON string of settings_data.json
    let settings: Record<string, unknown>;
    try {
      settings = JSON.parse(assetData.asset?.value ?? "{}");
    } catch {
      console.error("[SHOPIFY-EMBED-STATUS] Failed to parse settings_data.json");
      return new Response(JSON.stringify({ error: "Failed to parse theme settings" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: scan current.blocks for our embed block by uid
    // Blocks appear here after first enable; disabled:true means merchant turned it off
    const blocks = (settings?.current as Record<string, unknown>)?.blocks ?? {};
    const embedBlock = Object.values(blocks as Record<string, unknown>).find(
      (block): block is { type: string; disabled?: boolean } =>
        typeof (block as Record<string, unknown>)?.type === "string" &&
        ((block as Record<string, unknown>).type as string).includes(EMBED_BLOCK_UID)
    );

    const enabled = embedBlock !== undefined && embedBlock.disabled !== true;

    return new Response(JSON.stringify({ enabled }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[SHOPIFY-EMBED-STATUS] Unexpected error:", error instanceof Error ? error.message : "Unknown");
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
