import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Version for deployment tracking - update to force redeploy
const FUNCTION_VERSION = "1.0.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_CLIENT_ID = Deno.env.get("SHOPIFY_CLIENT_ID") || "";
const SHOPIFY_CLIENT_SECRET = Deno.env.get("SHOPIFY_CLIENT_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Required scopes for storefront access, checkout, and webhooks
const SCOPES = "read_products,read_product_listings,unauthenticated_read_product_listings,unauthenticated_read_product_tags,write_checkouts,unauthenticated_write_checkouts,write_script_tags";

// Webhook topics to register
const WEBHOOK_TOPICS = [
  "products/create",
  "products/update",
  "products/delete",
  "inventory_levels/update",
  "app/uninstalled",
];

// Generic error messages for client responses (no internal details)
const CLIENT_ERRORS = {
  MISSING_PARAMS: "Missing required parameters",
  INVALID_SHOP: "Invalid shop domain format",
  CONFIG_ERROR: "Service configuration error",
  AUTH_FAILED: "Authorization failed",
  INVALID_STATE: "Invalid request state",
  SAVE_FAILED: "Failed to complete connection",
  INVALID_ACTION: "Invalid request",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // Minimal logging - no sensitive data
  console.log(`[SHOPIFY-OAUTH] Action: ${action}, Method: ${req.method}`);

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

    // Test endpoint - minimal info for integration tests
    if (action === "test") {
      return new Response(JSON.stringify({
        status: "ok",
        version: FUNCTION_VERSION,
        configured: !!(SHOPIFY_CLIENT_ID && SHOPIFY_CLIENT_SECRET),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "authorize") {
      const shop = url.searchParams.get("shop");
      const redirectUri = url.searchParams.get("redirect_uri");
      const state = url.searchParams.get("state");

      if (!shop || !redirectUri || !state) {
        console.error("[SHOPIFY-OAUTH] Missing authorize parameters");
        return new Response(
          JSON.stringify({ error: CLIENT_ERRORS.MISSING_PARAMS }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate shop format
      const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
      if (!shopRegex.test(shop)) {
        console.error("[SHOPIFY-OAUTH] Invalid shop format");
        return new Response(
          JSON.stringify({ error: CLIENT_ERRORS.INVALID_SHOP }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!SHOPIFY_CLIENT_ID) {
        console.error("[SHOPIFY-OAUTH] Client ID not configured");
        return new Response(
          JSON.stringify({ error: CLIENT_ERRORS.CONFIG_ERROR }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const authUrl = `https://${shop}/admin/oauth/authorize?` +
        `client_id=${SHOPIFY_CLIENT_ID}&` +
        `scope=${encodeURIComponent(SCOPES)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${encodeURIComponent(state)}`;

      console.log("[SHOPIFY-OAUTH] Authorization URL generated");

      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "callback") {
      const code = url.searchParams.get("code");
      const shop = url.searchParams.get("shop");
      const state = url.searchParams.get("state");

      if (!code || !shop || !state) {
        console.error("[SHOPIFY-OAUTH] Missing callback parameters");
        return new Response(
          JSON.stringify({ error: CLIENT_ERRORS.MISSING_PARAMS }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
        console.error("[SHOPIFY-OAUTH] Missing credentials for token exchange");
        return new Response(
          JSON.stringify({ error: CLIENT_ERRORS.CONFIG_ERROR }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Exchange code for access token
      const tokenUrl = `https://${shop}/admin/oauth/access_token`;
      const tokenBody = {
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
        code,
      };

      const tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokenBody),
      });

      if (!tokenResponse.ok) {
        const errorBody = await tokenResponse.text();
        console.error(`[SHOPIFY-OAUTH] Token exchange failed with status ${tokenResponse.status}, body: ${errorBody}`);
        return new Response(
          JSON.stringify({ error: CLIENT_ERRORS.AUTH_FAILED }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      if (!accessToken) {
        console.error("[SHOPIFY-OAUTH] No access token in response");
        return new Response(
          JSON.stringify({ error: CLIENT_ERRORS.AUTH_FAILED }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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
        console.log("[SHOPIFY-OAUTH] Storefront token created");
      } else {
        console.warn("[SHOPIFY-OAUTH] Could not create storefront token");
      }

      // Parse state to get brand_id
      let brandId: string;
      try {
        const stateData = JSON.parse(atob(state));
        brandId = stateData.brand_id;
      } catch {
        console.error("[SHOPIFY-OAUTH] Invalid state parameter");
        return new Response(
          JSON.stringify({ error: CLIENT_ERRORS.INVALID_STATE }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Save tokens to database
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const updateData = {
        shopify_store_domain: shop,
        shopify_access_token: accessToken,
        shopify_storefront_token: storefrontToken,
        shopify_connected_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("brands")
        .update(updateData)
        .eq("id", brandId)
        .select();

      if (updateError) {
        console.error("[SHOPIFY-OAUTH] Database update failed");
        return new Response(
          JSON.stringify({ error: CLIENT_ERRORS.SAVE_FAILED }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("[SHOPIFY-OAUTH] Connection saved successfully");

      // Auto-install widget script tag
      const widgetLoaderUrl = `${SUPABASE_URL}/functions/v1/widget-loader?brand_id=${brandId}`;
      let widgetScriptTagId: string | null = null;

      try {
        const scriptTagResponse = await fetch(
          `https://${shop}/admin/api/2025-01/script_tags.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": accessToken,
            },
            body: JSON.stringify({
              script_tag: {
                event: "onload",
                src: widgetLoaderUrl,
              },
            }),
          }
        );

        if (scriptTagResponse.ok) {
          const scriptTagData = await scriptTagResponse.json();
          widgetScriptTagId = String(scriptTagData.script_tag?.id);

          await supabase
            .from("brands")
            .update({ widget_script_tag_id: widgetScriptTagId })
            .eq("id", brandId);

          console.log("[SHOPIFY-OAUTH] Widget script tag installed");
        } else {
          console.warn("[SHOPIFY-OAUTH] Could not install widget script tag");
        }
      } catch {
        console.warn("[SHOPIFY-OAUTH] Widget script tag installation failed");
      }

      // Auto-register webhooks
      const webhookBaseUrl = `${SUPABASE_URL}/functions/v1/shopify-webhooks`;
      const registeredWebhooks: string[] = [];
      const failedWebhooks: string[] = [];

      for (const topic of WEBHOOK_TOPICS) {
        try {
          const webhookResponse = await fetch(
            `https://${shop}/admin/api/2025-01/webhooks.json`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": accessToken,
              },
              body: JSON.stringify({
                webhook: {
                  topic,
                  address: webhookBaseUrl,
                  format: "json",
                },
              }),
            }
          );

          if (webhookResponse.ok || webhookResponse.status === 422) {
            registeredWebhooks.push(topic);
          } else {
            failedWebhooks.push(topic);
          }
        } catch {
          failedWebhooks.push(topic);
        }
      }

      console.log(`[SHOPIFY-OAUTH] Webhooks: ${registeredWebhooks.length}/${WEBHOOK_TOPICS.length} registered`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          shop,
          webhooksRegistered: registeredWebhooks.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: CLIENT_ERRORS.INVALID_ACTION }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[SHOPIFY-OAUTH] Unexpected error:", error instanceof Error ? error.message : "Unknown");
    return new Response(
      JSON.stringify({ error: CLIENT_ERRORS.AUTH_FAILED }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
