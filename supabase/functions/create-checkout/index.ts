import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

const TIERS: Record<string, { name: string; amount: number; trialDays: number }> = {
  starter: { name: "Starter", amount: 14.99, trialDays: 3 },
  professional: { name: "Professional", amount: 29.99, trialDays: 3 },
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

    const { plan } = await req.json();
    if (!plan || !TIERS[plan]) throw new Error("Invalid plan. Must be 'starter' or 'professional'");
    const tier = TIERS[plan];
    logStep("Plan selected", { plan, tier });

    // Get user's brand to find their Shopify store
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("brand_id")
      .eq("id", user.id)
      .single();

    if (!profile?.brand_id) throw new Error("No brand found for user");

    const { data: brand } = await supabaseClient
      .from("brands")
      .select("shopify_store_domain, shopify_access_token")
      .eq("id", profile.brand_id)
      .single();

    if (!brand?.shopify_store_domain || !brand?.shopify_access_token) {
      throw new Error("Shopify store not connected. Please connect your Shopify store first.");
    }

    logStep("Brand found", { domain: brand.shopify_store_domain });

    const origin = req.headers.get("origin") || "http://localhost:3000";

    // Create app subscription via Shopify Admin API
    const mutation = `
      mutation AppSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $trialDays: Int) {
        appSubscriptionCreate(name: $name, returnUrl: $returnUrl, lineItems: $lineItems, trialDays: $trialDays) {
          appSubscription {
            id
            name
            status
          }
          confirmationUrl
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      name: `STYLYS ${tier.name}`,
      returnUrl: `${origin}/settings?billing=success`,
      trialDays: tier.trialDays,
      lineItems: [{
        plan: {
          appRecurringPricingDetails: {
            price: { amount: tier.amount, currencyCode: "USD" },
          },
        },
      }],
    };

    const shopifyResp = await fetch(
      `https://${brand.shopify_store_domain}/admin/api/2025-01/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": brand.shopify_access_token,
        },
        body: JSON.stringify({ query: mutation, variables }),
      }
    );

    const shopifyData = await shopifyResp.json();
    logStep("Shopify response", shopifyData);

    if (shopifyData.data?.appSubscriptionCreate?.userErrors?.length > 0) {
      const errors = shopifyData.data.appSubscriptionCreate.userErrors;
      throw new Error(`Shopify billing error: ${errors.map((e: any) => e.message).join(", ")}`);
    }

    const confirmationUrl = shopifyData.data?.appSubscriptionCreate?.confirmationUrl;
    if (!confirmationUrl) {
      throw new Error("No confirmation URL returned from Shopify");
    }

    logStep("Confirmation URL created", { url: confirmationUrl });

    return new Response(JSON.stringify({ url: confirmationUrl }), {
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
