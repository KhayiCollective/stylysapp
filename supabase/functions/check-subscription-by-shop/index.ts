import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shop_domain } = await req.json();
    if (!shop_domain) {
      return new Response(JSON.stringify({ error: "shop_domain required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Normalize domain — accept "store.myshopify.com" or "store"
    const domain = shop_domain.includes(".myshopify.com")
      ? shop_domain
      : `${shop_domain}.myshopify.com`;

    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("shopify_access_token")
      .eq("shopify_store_domain", domain)
      .maybeSingle();

    if (brandError || !brand?.shopify_access_token) {
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const query = `
      query {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            currentPeriodEnd
            trialDays
          }
        }
      }
    `;

    const shopifyResp = await fetch(
      `https://${domain}/admin/api/2025-01/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": brand.shopify_access_token,
        },
        body: JSON.stringify({ query }),
      }
    );

    const shopifyData = await shopifyResp.json();
    const subscriptions =
      shopifyData.data?.currentAppInstallation?.activeSubscriptions ?? [];

    if (subscriptions.length === 0) {
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const sub = subscriptions[0];
    const planName: string = sub.name ?? "";

    let tierName: string | null = null;
    if (planName.toLowerCase().includes("professional") || planName.toLowerCase().includes("pro")) {
      tierName = "professional";
    } else if (planName.toLowerCase().includes("starter")) {
      tierName = "starter";
    }

    return new Response(
      JSON.stringify({
        subscribed: true,
        plan_name: planName,
        tier_name: tierName,
        subscription_end: sub.currentPeriodEnd ?? null,
        is_trialing: sub.trialDays > 0 && sub.status === "ACTIVE",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
