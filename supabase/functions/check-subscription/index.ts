import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

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

    if (!profile?.brand_id) {
      logStep("No brand found");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { data: brand } = await supabaseClient
      .from("brands")
      .select("shopify_store_domain, shopify_access_token")
      .eq("id", profile.brand_id)
      .single();

    if (!brand?.shopify_store_domain || !brand?.shopify_access_token) {
      logStep("Shopify not connected");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Checking Shopify subscription", { domain: brand.shopify_store_domain });

    // Query currentAppInstallation for active subscriptions
    const query = `
      query {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            currentPeriodEnd
            trialDays
            test
            lineItems {
              plan {
                pricingDetails {
                  ... on AppRecurringPricing {
                    price {
                      amount
                      currencyCode
                    }
                    interval
                  }
                }
              }
            }
          }
        }
      }
    `;

    const shopifyResp = await fetch(
      `https://${brand.shopify_store_domain}/admin/api/2025-01/graphql.json`,
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
    logStep("Shopify response received");

    const subscriptions = shopifyData.data?.currentAppInstallation?.activeSubscriptions || [];
    
    if (subscriptions.length === 0) {
      logStep("No active subscriptions");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const sub = subscriptions[0];
    const planName = sub.name || "";
    
    // Determine tier from subscription name
    let tierName: string | null = null;
    if (planName.toLowerCase().includes("professional") || planName.toLowerCase().includes("pro")) {
      tierName = "professional";
    } else if (planName.toLowerCase().includes("starter")) {
      tierName = "starter";
    }

    const isTrialing = sub.trialDays > 0 && sub.status === "ACTIVE";
    const subscriptionEnd = sub.currentPeriodEnd || null;

    logStep("Subscription found", { planName, tierName, status: sub.status, isTrialing });

    return new Response(JSON.stringify({
      subscribed: true,
      plan_name: planName,
      tier_name: tierName,
      subscription_end: subscriptionEnd,
      is_trialing: isTrialing,
      trial_days: sub.trialDays,
    }), {
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
