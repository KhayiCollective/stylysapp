import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brand_id, action } = await req.json();

    if (!brand_id || !action) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch brand details
    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("shopify_store_domain, shopify_access_token, widget_script_tag_id")
      .eq("id", brand_id)
      .single();

    if (brandError || !brand?.shopify_store_domain || !brand?.shopify_access_token) {
      return new Response(JSON.stringify({ error: "Store not connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { shopify_store_domain: shop, shopify_access_token: accessToken } = brand;
    const widgetLoaderUrl = `${SUPABASE_URL}/functions/v1/widget-loader?brand_id=${brand_id}`;

    if (action === "install") {
      // Create script tag
      const response = await fetch(
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

      if (!response.ok) {
        const errText = await response.text();
        console.error("[WIDGET-TOGGLE] Failed to create script tag:", errText);
        const isScopeError = errText.includes("scope") || errText.includes("access denied") || errText.includes("403") || response.status === 403;
        return new Response(JSON.stringify({ 
          error: isScopeError ? "scope_error" : "Failed to install widget",
          detail: isScopeError ? "Your store needs to re-authorize with updated permissions." : errText,
        }), {
          status: isScopeError ? 403 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const scriptTagId = String(data.script_tag?.id);

      // Save script tag ID
      await supabase
        .from("brands")
        .update({ widget_script_tag_id: scriptTagId })
        .eq("id", brand_id);

      return new Response(JSON.stringify({ success: true, script_tag_id: scriptTagId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "remove") {
      const scriptTagId = brand.widget_script_tag_id;

      if (scriptTagId) {
        // Delete script tag from Shopify
        await fetch(
          `https://${shop}/admin/api/2025-01/script_tags/${scriptTagId}.json`,
          {
            method: "DELETE",
            headers: { "X-Shopify-Access-Token": accessToken },
          }
        );
      }

      // Clear script tag ID
      await supabase
        .from("brands")
        .update({ widget_script_tag_id: null })
        .eq("id", brand_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[WIDGET-TOGGLE] Error:", error instanceof Error ? error.message : "Unknown");
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
