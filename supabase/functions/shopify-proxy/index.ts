import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

const SHOPIFY_API_VERSION = "2025-01";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, variables, brandId } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Missing GraphQL query" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[SHOPIFY-PROXY] Request for brand: ${brandId || "unknown"}`);

    // Get brand credentials from database
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let brandQuery = supabase.from("brands").select("shopify_store_domain, shopify_storefront_token");

    if (brandId) {
      brandQuery = brandQuery.eq("id", brandId);
    } else {
      // If no brandId provided, try to get from auth
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const { data: userData } = await supabase.auth.getUser(token);
        if (userData?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("brand_id")
            .eq("id", userData.user.id)
            .single();
          
          if (profile?.brand_id) {
            brandQuery = brandQuery.eq("id", profile.brand_id);
          }
        }
      }
    }

    const { data: brand, error: brandError } = await brandQuery.single();

    if (brandError || !brand) {
      console.error(`[SHOPIFY-PROXY] Brand not found: ${brandError?.message}`);
      return new Response(
        JSON.stringify({ error: "Brand not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!brand.shopify_store_domain || !brand.shopify_storefront_token) {
      console.error(`[SHOPIFY-PROXY] Shopify not connected for brand`);
      return new Response(
        JSON.stringify({ error: "Shopify not connected for this brand" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const storefrontUrl = `https://${brand.shopify_store_domain}/api/${SHOPIFY_API_VERSION}/graphql.json`;

    console.log(`[SHOPIFY-PROXY] Proxying to: ${storefrontUrl}`);

    const response = await fetch(storefrontUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": brand.shopify_storefront_token,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (response.status === 402) {
      return new Response(
        JSON.stringify({ error: "Shopify payment required - store needs active subscription" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SHOPIFY-PROXY] Shopify error: ${errorText}`);
      return new Response(
        JSON.stringify({ error: "Shopify API error" }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    if (data.errors) {
      console.error(`[SHOPIFY-PROXY] GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[SHOPIFY-PROXY] Error: ${errorMessage}`);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
