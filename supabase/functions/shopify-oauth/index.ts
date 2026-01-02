import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// Version for deployment tracking - update to force redeploy
const FUNCTION_VERSION = "1.0.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_CLIENT_ID = Deno.env.get("SHOPIFY_CLIENT_ID") || "";
const SHOPIFY_CLIENT_SECRET = Deno.env.get("SHOPIFY_CLIENT_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Required scopes for storefront access and checkout
const SCOPES = "read_products,read_product_listings,unauthenticated_read_product_listings,unauthenticated_read_product_tags,write_checkouts,unauthenticated_write_checkouts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  console.log(`[SHOPIFY-OAUTH v${FUNCTION_VERSION}] ========== REQUEST START ==========`);
  console.log(`[SHOPIFY-OAUTH] Action: ${action}`);
  console.log(`[SHOPIFY-OAUTH] Method: ${req.method}`);
  console.log(`[SHOPIFY-OAUTH] URL: ${req.url}`);
  console.log(`[SHOPIFY-OAUTH] CLIENT_ID set: ${!!SHOPIFY_CLIENT_ID && SHOPIFY_CLIENT_ID.length > 0}`);
  console.log(`[SHOPIFY-OAUTH] CLIENT_SECRET set: ${!!SHOPIFY_CLIENT_SECRET && SHOPIFY_CLIENT_SECRET.length > 0}`);

  try {
    // Health check endpoint - simple and fast
    if (action === "health") {
      return new Response(JSON.stringify({
        status: "ok",
        version: FUNCTION_VERSION,
        timestamp: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Test endpoint for integration tests
    if (action === "test") {
      return new Response(JSON.stringify({
        status: "ok",
        version: FUNCTION_VERSION,
        hasClientId: !!SHOPIFY_CLIENT_ID && SHOPIFY_CLIENT_ID.length > 0,
        hasClientSecret: !!SHOPIFY_CLIENT_SECRET && SHOPIFY_CLIENT_SECRET.length > 0,
        message: "Edge function is deployed and responding",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Debug endpoint for testing
    if (action === "debug") {
      return new Response(JSON.stringify({
        version: FUNCTION_VERSION,
        hasClientId: !!SHOPIFY_CLIENT_ID && SHOPIFY_CLIENT_ID.length > 0,
        hasClientSecret: !!SHOPIFY_CLIENT_SECRET && SHOPIFY_CLIENT_SECRET.length > 0,
        supabaseUrl: !!SUPABASE_URL,
        clientIdLength: SHOPIFY_CLIENT_ID?.length || 0,
        scopes: SCOPES,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "authorize") {
      // Step 1: Redirect user to Shopify OAuth
      const shop = url.searchParams.get("shop");
      const redirectUri = url.searchParams.get("redirect_uri");
      const state = url.searchParams.get("state"); // Include user session/brand ID

      console.log(`[SHOPIFY-OAUTH] Authorize request:`);
      console.log(`[SHOPIFY-OAUTH] - Shop: ${shop}`);
      console.log(`[SHOPIFY-OAUTH] - Redirect URI: ${redirectUri}`);
      console.log(`[SHOPIFY-OAUTH] - State provided: ${!!state}`);

      if (!shop || !redirectUri || !state) {
        console.error(`[SHOPIFY-OAUTH] Missing parameters - shop: ${!!shop}, redirectUri: ${!!redirectUri}, state: ${!!state}`);
        return new Response(
          JSON.stringify({ error: "Missing shop, redirect_uri, or state parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate shop format
      const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
      if (!shopRegex.test(shop)) {
        console.error(`[SHOPIFY-OAUTH] Invalid shop format: ${shop}`);
        return new Response(
          JSON.stringify({ error: "Invalid shop domain format. Use: yourstore.myshopify.com" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!SHOPIFY_CLIENT_ID) {
        console.error(`[SHOPIFY-OAUTH] SHOPIFY_CLIENT_ID is not configured!`);
        return new Response(
          JSON.stringify({ error: "SHOPIFY_CLIENT_ID is not configured. Please add it to your backend secrets." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const authUrl = `https://${shop}/admin/oauth/authorize?` +
        `client_id=${SHOPIFY_CLIENT_ID}&` +
        `scope=${encodeURIComponent(SCOPES)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${encodeURIComponent(state)}`;

      console.log(`[SHOPIFY-OAUTH] Generated auth URL (truncated): ${authUrl.substring(0, 100)}...`);

      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "callback") {
      // Step 2: Exchange code for access token
      const code = url.searchParams.get("code");
      const shop = url.searchParams.get("shop");
      const state = url.searchParams.get("state"); // Contains brand_id

      console.log(`[SHOPIFY-OAUTH] Callback request:`);
      console.log(`[SHOPIFY-OAUTH] - Code provided: ${!!code} (length: ${code?.length || 0})`);
      console.log(`[SHOPIFY-OAUTH] - Shop: ${shop}`);
      console.log(`[SHOPIFY-OAUTH] - State provided: ${!!state}`);

      if (!code || !shop || !state) {
        console.error(`[SHOPIFY-OAUTH] Callback missing parameters`);
        return new Response(
          JSON.stringify({ error: "Missing code, shop, or state parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
        console.error(`[SHOPIFY-OAUTH] Missing client credentials for token exchange`);
        return new Response(
          JSON.stringify({ error: "Shopify credentials not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[SHOPIFY-OAUTH] Exchanging code for token, shop: ${shop}`);

      // Exchange code for access token
      const tokenUrl = `https://${shop}/admin/oauth/access_token`;
      const tokenBody = {
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
        code,
      };

      console.log(`[SHOPIFY-OAUTH] Token exchange URL: ${tokenUrl}`);

      const tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokenBody),
      });

      console.log(`[SHOPIFY-OAUTH] Token response status: ${tokenResponse.status}`);

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error(`[SHOPIFY-OAUTH] Token exchange failed: ${errorText}`);
        return new Response(
          JSON.stringify({ 
            error: "Failed to exchange code for access token",
            details: errorText,
            status: tokenResponse.status
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      console.log(`[SHOPIFY-OAUTH] Got access token: ${!!accessToken}`);

      if (!accessToken) {
        console.error(`[SHOPIFY-OAUTH] No access token in response: ${JSON.stringify(tokenData)}`);
        return new Response(
          JSON.stringify({ error: "No access token received from Shopify" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[SHOPIFY-OAUTH] Creating storefront token...`);

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

      console.log(`[SHOPIFY-OAUTH] Storefront token response status: ${storefrontResponse.status}`);

      let storefrontToken = null;
      if (storefrontResponse.ok) {
        const storefrontData = await storefrontResponse.json();
        storefrontToken = storefrontData.storefront_access_token?.access_token;
        console.log(`[SHOPIFY-OAUTH] Created storefront token: ${!!storefrontToken}`);
      } else {
        const storefrontError = await storefrontResponse.text();
        console.warn(`[SHOPIFY-OAUTH] Could not create storefront token: ${storefrontError}`);
      }

      // Parse state to get brand_id
      let brandId: string;
      try {
        const stateData = JSON.parse(atob(state));
        brandId = stateData.brand_id;
        console.log(`[SHOPIFY-OAUTH] Parsed brand_id: ${brandId}`);
      } catch (e) {
        console.error(`[SHOPIFY-OAUTH] Failed to parse state: ${e}`);
        return new Response(
          JSON.stringify({ error: "Invalid state parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Save tokens to database
      console.log(`[SHOPIFY-OAUTH] Saving to database...`);
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const updateData = {
        shopify_store_domain: shop,
        shopify_access_token: accessToken,
        shopify_storefront_token: storefrontToken,
        shopify_connected_at: new Date().toISOString(),
      };

      console.log(`[SHOPIFY-OAUTH] Update data (tokens hidden): ${JSON.stringify({
        shopify_store_domain: shop,
        shopify_access_token: '***',
        shopify_storefront_token: storefrontToken ? '***' : null,
        shopify_connected_at: updateData.shopify_connected_at,
      })}`);

      const { data, error: updateError } = await supabase
        .from("brands")
        .update(updateData)
        .eq("id", brandId)
        .select();

      if (updateError) {
        console.error(`[SHOPIFY-OAUTH] Failed to save tokens: ${updateError.message}`);
        return new Response(
          JSON.stringify({ error: "Failed to save Shopify credentials", details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[SHOPIFY-OAUTH] Database update result: ${JSON.stringify(data)}`);
      console.log(`[SHOPIFY-OAUTH] Successfully connected shop ${shop} to brand ${brandId}`);
      console.log(`[SHOPIFY-OAUTH] ========== REQUEST END ==========`);

      return new Response(
        JSON.stringify({ success: true, shop }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[SHOPIFY-OAUTH] Invalid action: ${action}`);
    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error(`[SHOPIFY-OAUTH] Error: ${errorMessage}`);
    console.error(`[SHOPIFY-OAUTH] Stack: ${errorStack}`);
    console.log(`[SHOPIFY-OAUTH] ========== REQUEST END (ERROR) ==========`);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
