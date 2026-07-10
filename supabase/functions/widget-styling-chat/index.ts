import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
  if (!rateLimit(ip)) {
    return new Response(JSON.stringify({ error: "Too many requests. Please slow down." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { brand_id, messages, customer_context } = await req.json();
    if (!brand_id) {
      return new Response(JSON.stringify({ error: "brand_id is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Subscription gate: brand_id → Shopify credentials → activeSubscriptions
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: tokens } = await supabase.rpc("get_brand_shopify_token", {
      target_brand_id: brand_id,
    });
    const accessToken = tokens?.[0]?.access_token;

    const { data: brand } = await supabase
      .from("brands")
      .select("shopify_store_domain")
      .eq("id", brand_id)
      .single();

    if (brand?.shopify_store_domain && accessToken) {
      const query = `query { currentAppInstallation { activeSubscriptions { name status } } }`;
      const shopifyResp = await fetch(
        `https://${brand.shopify_store_domain}/admin/api/2025-01/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
          },
          body: JSON.stringify({ query }),
        }
      );
      const shopifyData = await shopifyResp.json();
      const subs = shopifyData.data?.currentAppInstallation?.activeSubscriptions || [];
      const hasPro = subs.some(
        (s: any) =>
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

    // Fetch products server-side from Supabase products table
    const { data: rawProducts } = await supabase
      .from("products")
      .select("name, price, image_url, shopify_handle, shopify_variant_id, category, product_type")
      .eq("brand_id", brand_id)
      .limit(200);

    const products = (rawProducts || []).map((p: any) => ({
      name: p.name,
      price: p.price ?? 0,
      handle: p.shopify_handle || "",
      image: p.image_url || "",
      variantId: p.shopify_variant_id ? `gid://shopify/ProductVariant/${p.shopify_variant_id}` : "",
      category: p.category || p.product_type || "",
    }));

    // Build product context string
    let productContext = "";
    if (products.length > 0) {
      productContext =
        `\n\nAvailable products in catalog (use these EXACT details when recommending):\n` +
        products
          .map(
            (p: any) =>
              `- "${p.name}" | Price: $${p.price} | Category: ${p.category || "N/A"} | Handle: ${p.handle || "N/A"} | Image: ${p.image || ""} | VariantId: ${p.variantId || ""}`
          )
          .join("\n");
    }

    let customerContextStr = "";
    if (customer_context && typeof customer_context === "object") {
      const lines: string[] = [];
      if (customer_context.occasion) lines.push(`Shopping occasion: ${customer_context.occasion}`);
      if (customer_context.budget) lines.push(`Budget: ${customer_context.budget}`);
      if (Array.isArray(customer_context.preferred_colors) && customer_context.preferred_colors.length)
        lines.push(`Preferred colors: ${customer_context.preferred_colors.join(", ")}`);
      if (Array.isArray(customer_context.avoided_colors) && customer_context.avoided_colors.length)
        lines.push(`Avoid colors: ${customer_context.avoided_colors.join(", ")}`);
      if (customer_context.body_shape) lines.push(`Body shape: ${customer_context.body_shape}`);
      if (customer_context.size_info && typeof customer_context.size_info === "object") {
        const sizeEntries = Object.entries(customer_context.size_info)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");
        if (sizeEntries) lines.push(`Sizes: ${sizeEntries}`);
      }
      if (lines.length > 0)
        customerContextStr = `\n\nCustomer profile for this session (use to personalise recommendations):\n${lines.join("\n")}`;
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
- Always include a brief text explanation before or after the product blocks explaining WHY each product matches
- If suggesting a complete outfit, label it "Complete Look — X items:" before the product blocks

Guidelines:
- Always be encouraging and positive about fashion choices
- Consider the customer's preferences, budget, and occasion
- If asked about something outside fashion/styling, politely redirect to styling topics
- When the customer is vague, ask a clarifying question about their occasion, style preference, or budget before recommending
${customerContextStr}${productContext}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ error: "AI service error." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Widget styling chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
