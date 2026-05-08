import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Per-IP rate limit (in-memory, per instance) to deter unauthenticated credit abuse.
const rateBuckets = new Map<string, { count: number; reset: number }>();
function rateLimit(ip: string, limit = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.reset) {
    rateBuckets.set(ip, { count: 1, reset: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
  if (!rateLimit(ip)) {
    return new Response(JSON.stringify({ error: "Too many requests. Please slow down." }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ── Subscription gate ──────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    if (authHeader && authHeader !== `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabaseClient.auth.getUser(token);
      if (userData?.user) {
        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("brand_id")
          .eq("id", userData.user.id)
          .single();

        if (profile?.brand_id) {
          const { data: brand } = await supabaseClient
            .from("brands")
            .select("shopify_store_domain, shopify_access_token")
            .eq("id", profile.brand_id)
            .single();

          if (brand?.shopify_store_domain && brand?.shopify_access_token) {
            const query = `query { currentAppInstallation { activeSubscriptions { name status } } }`;
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
            const subs = shopifyData.data?.currentAppInstallation?.activeSubscriptions || [];
            const hasPro = subs.some((s: any) =>
              s.status === "ACTIVE" &&
              (s.name?.toLowerCase().includes("professional") || s.name?.toLowerCase().includes("pro"))
            );

            if (!hasPro) {
              return new Response(
                JSON.stringify({ error: "AI Chatbot requires a Professional plan." }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        }
      }
    }

    // ── Chat logic ─────────────────────────────────────────────────
    const { messages, products } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Styling chat request received:", { messageCount: messages?.length, hasProducts: !!products });

    // Build product context if available
    let productContext = "";
    if (products && products.length > 0) {
      productContext = `\n\nAvailable products in catalog (use these EXACT details when recommending):\n${products.map((p: any) => 
        `- "${p.name}" | Price: $${p.price} | Category: ${p.category} | Color: ${p.color || 'N/A'} | Fit: ${p.fit || 'N/A'} | Handle: ${p.handle || 'N/A'} | Image: ${p.image || ''} | VariantId: ${p.variantId || ''}`
      ).join('\n')}`;
    }

    const systemPrompt = `You are a friendly and knowledgeable personal stylist AI assistant for an online fashion store. Your role is to:

1. **Answer styling questions**: Help customers with outfit coordination, color matching, seasonal trends, body type recommendations, and occasion-appropriate dressing.

2. **Recommend products**: When customers describe what they're looking for, suggest specific products from the catalog. ONLY recommend products that closely match what the customer is asking for — match by category, color, occasion, price range, and style keywords. Do NOT randomly suggest products.

3. **Provide outfit ideas**: Create complete outfit suggestions using items from the catalog that work well together and match the customer's stated needs.

4. **Be conversational and helpful**: Use a warm, professional tone. Keep responses concise but informative.

MATCHING RULES (VERY IMPORTANT):
- If a customer asks for "a blue dress", only recommend items that are dresses AND blue/navy colored.
- If a customer asks for "casual tops under $50", only recommend tops that are casual AND under $50.
- If a customer asks for outfit ideas for "date night", pick items that are date-appropriate (not gym wear, not workwear).
- If no products in the catalog match what the customer wants, say so honestly — do NOT force unrelated products.
- Consider the customer's previous messages for context (e.g. if they mentioned a budget or occasion earlier).

CRITICAL PRODUCT RECOMMENDATION FORMAT:
When recommending specific products, you MUST embed product data as a special JSON block so the UI can render interactive product cards. Use this exact format:

\`\`\`product
{"name":"Product Name","price":99.99,"handle":"product-handle","image":"image-url","variantId":"gid://shopify/ProductVariant/123","category":"tops"}
\`\`\`

Rules for product blocks:
- Place each product block on its own line after your text description of why you recommend it
- Use the EXACT product data from the catalog (name, price, handle, image, variantId)
- You can recommend 1-6 products per response
- Always include a brief text explanation before or after the product blocks explaining WHY each product matches what they asked for
- If suggesting a complete outfit/bundle, group the products together and label it as a "Complete Look" or "Outfit Bundle"
- For bundles, add a line like "**Complete Look — X items:**" before the product blocks

Guidelines:
- Always be encouraging and positive about fashion choices
- Consider the customer's preferences, budget, and occasion
- If asked about something outside fashion/styling, politely redirect to styling topics
- Use fashion terminology but explain it when needed
- When the customer is vague, ask a clarifying question about their occasion, style preference, or budget before recommending
${productContext}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Streaming response from AI gateway");

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Styling chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
