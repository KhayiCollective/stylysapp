import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { verifyShopifySessionToken } from "../_shared/shopify-session-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-shopify-session-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SHOPIFY_CLIENT_ID = Deno.env.get("SHOPIFY_CLIENT_ID") || "";
const SHOPIFY_CLIENT_SECRET = Deno.env.get("SHOPIFY_CLIENT_SECRET") || "";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started — Managed Pricing redirect mode");

    const supabaseClient = createClient(
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
          supabaseClient,
          SHOPIFY_CLIENT_ID,
          SHOPIFY_CLIENT_SECRET,
        );
        brandId = resolvedBrandId;
        logStep("Authenticated via Shopify session token", { brandId });
      } catch (err) {
        throw new Error(`Invalid Shopify session token: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("No authorization header provided");

      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
      if (userError) throw new Error(`Authentication error: ${userError.message}`);
      const user = userData.user;
      if (!user?.email) throw new Error("User not authenticated or email not available");
      logStep("User authenticated", { email: user.email });

      // Get user's brand to find their Shopify store
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("brand_id")
        .eq("id", user.id)
        .single();

      if (!profile?.brand_id) throw new Error("No brand found for user");
      brandId = profile.brand_id;
    }

    const { data: brand } = await supabaseClient
      .from("brands")
      .select("shopify_store_domain")
      .eq("id", brandId)
      .single();

    if (!brand?.shopify_store_domain) {
      throw new Error("Shopify store not connected. Please connect your Shopify store first.");
    }

    logStep("Brand found", { domain: brand.shopify_store_domain });

    // For Managed Pricing apps, redirect to the Shopify admin billing page
    // Shopify handles plan selection and billing natively
    const billingUrl = `https://${brand.shopify_store_domain}/admin/app/billing`;

    logStep("Returning Shopify managed billing URL", { url: billingUrl });

    return new Response(JSON.stringify({ url: billingUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
