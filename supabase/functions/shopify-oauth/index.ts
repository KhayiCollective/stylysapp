import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_CLIENT_ID = Deno.env.get("SHOPIFY_CLIENT_ID") || "";
const SHOPIFY_CLIENT_SECRET = Deno.env.get("SHOPIFY_CLIENT_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Required scopes for storefront access
const SCOPES = "read_products,read_product_listings,unauthenticated_read_product_listings,unauthenticated_read_product_tags";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  console.log(`[SHOPIFY-OAUTH] Action: ${action}`);

  try {
    if (action === "authorize") {
      // Step 1: Redirect user to Shopify OAuth
      const shop = url.searchParams.get("shop");
      const redirectUri = url.searchParams.get("redirect_uri");
      const state = url.searchParams.get("state"); // Include user session/brand ID

      if (!shop || !redirectUri || !state) {
        return new Response(
          JSON.stringify({ error: "Missing shop, redirect_uri, or state parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate shop format
      const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
      if (!shopRegex.test(shop)) {
        return new Response(
          JSON.stringify({ error: "Invalid shop domain format. Use: yourstore.myshopify.com" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const authUrl = `https://${shop}/admin/oauth/authorize?` +
        `client_id=${SHOPIFY_CLIENT_ID}&` +
        `scope=${encodeURIComponent(SCOPES)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${encodeURIComponent(state)}`;

      console.log(`[SHOPIFY-OAUTH] Redirecting to: ${authUrl}`);

      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "callback") {
      // Step 2: Exchange code for access token
      const code = url.searchParams.get("code");
      const shop = url.searchParams.get("shop");
      const state = url.searchParams.get("state"); // Contains brand_id

      if (!code || !shop || !state) {
        return new Response(
          JSON.stringify({ error: "Missing code, shop, or state parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[SHOPIFY-OAUTH] Exchanging code for token, shop: ${shop}`);

      // Exchange code for access token
      const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: SHOPIFY_CLIENT_ID,
          client_secret: SHOPIFY_CLIENT_SECRET,
          code,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error(`[SHOPIFY-OAUTH] Token exchange failed: ${errorText}`);
        return new Response(
          JSON.stringify({ error: "Failed to exchange code for access token" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      console.log(`[SHOPIFY-OAUTH] Got access token, creating storefront token...`);

      // Create a Storefront API token
      const storefrontResponse = await fetch(
        `https://${shop}/admin/api/2025-01/storefront_access_tokens.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
          },
          body: JSON.stringify({
            storefront_access_token: {
              title: "AI Stylist Platform",
            },
          }),
        }
      );

      let storefrontToken = null;
      if (storefrontResponse.ok) {
        const storefrontData = await storefrontResponse.json();
        storefrontToken = storefrontData.storefront_access_token?.access_token;
        console.log(`[SHOPIFY-OAUTH] Created storefront token`);
      } else {
        console.warn(`[SHOPIFY-OAUTH] Could not create storefront token, will use admin token`);
      }

      // Parse state to get brand_id
      let brandId: string;
      try {
        const stateData = JSON.parse(atob(state));
        brandId = stateData.brand_id;
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid state parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Save tokens to database
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { error: updateError } = await supabase
        .from("brands")
        .update({
          shopify_store_domain: shop,
          shopify_access_token: accessToken,
          shopify_storefront_token: storefrontToken,
          shopify_connected_at: new Date().toISOString(),
        })
        .eq("id", brandId);

      if (updateError) {
        console.error(`[SHOPIFY-OAUTH] Failed to save tokens: ${updateError.message}`);
        return new Response(
          JSON.stringify({ error: "Failed to save Shopify credentials" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[SHOPIFY-OAUTH] Successfully connected shop ${shop} to brand ${brandId}`);

      return new Response(
        JSON.stringify({ success: true, shop }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[SHOPIFY-OAUTH] Error: ${errorMessage}`);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
