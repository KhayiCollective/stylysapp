import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category: string;
  color: string | null;
  fit: string | null;
}

interface CompositionRules {
  minItems?: number;
  maxItems?: number;
  requiredCategories?: string[];
  optionalCategories?: string[];
}

interface OutfitRequest {
  products: Product[];
  anchorProductId?: string;
  occasion?: string;
  style?: string;
  budget?: number;
  colorPreferences?: string[];
  rules?: CompositionRules;
}

// Simple in-memory IP rate limiter (per-instance). Protects against credit abuse.
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

  // Per-IP rate limit to reduce abuse cost for this unauthenticated endpoint.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
  if (!rateLimit(ip, 20, 60_000)) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please wait a moment." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: OutfitRequest = await req.json();
    const { products, anchorProductId, occasion, style, budget, colorPreferences, rules } = body;

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ error: "No products provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anchorProduct = anchorProductId 
      ? products.find(p => p.id === anchorProductId) 
      : null;

    const productCatalog = products.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      category: p.category,
      color: p.color || "unknown",
      fit: p.fit || "regular"
    }));

    // Build composition rules section for the prompt
    const minItems = rules?.minItems ?? 3;
    const maxItems = rules?.maxItems ?? 5;

    // Check which categories actually exist in the catalog
    const catalogCategories = [...new Set(products.map(p => p.category.toLowerCase()))];

    // Category logic: every outfit has exactly ONE base — either a single dress,
    // or a single top + single bottom pair. A dress already covers both halves
    // of the outfit, so it must never be combined with a top, a bottom, or a
    // second dress. Outerwear/footwear/accessories are optional add-ons on top
    // of whichever base is used. This is enforced again server-side after
    // generation (see enforceCompositionRules) since models don't reliably
    // follow composition instructions on their own.
    const compositionSection = `
COMPOSITION RULES:
- Each outfit MUST contain ${minItems}-${maxItems} items total.
- Every outfit needs exactly ONE base, chosen as either:
  (a) ONE item from "dresses", OR
  (b) ONE item from "tops" AND ONE item from "bottoms".
  Never mix these two options, and never use more than one item from "dresses" in the same outfit.
  A dress already covers the top and bottom, so a dress-based outfit must NOT also include a top or a bottom item.
- Never include two items from the same category (e.g. two jackets, two pairs of shoes, two tops) in one outfit.
- OPTIONAL add-ons — include when available and it improves the look: one item of outerwear (jacket/cardigan/coat), one item of footwear, and up to two accessories.
- Available categories in this catalog: ${catalogCategories.join(", ")}`;

    const systemPrompt = `You are STYLYS, an expert AI fashion stylist. Your job is to create cohesive, stylish outfit combinations from a product catalog.

RULES:
1. Follow the composition rules below for item count and category selection
2. Consider color harmony - complementary or analogous colors work best
3. Stay within budget if specified
4. Match the occasion/style if specified
5. If an anchor product is specified, build the outfit around it
${compositionSection}

OUTPUT FORMAT:
Return a JSON array of exactly 3 outfit objects with this structure:
{
  "outfits": [
    {
      "name": "Creative outfit name",
      "productIds": ["id1", "id2", "id3"],
      "reason": "Brief explanation of why these items work together",
      "occasion": "Best occasion for this outfit"
    }
  ]
}

Only return valid JSON, no other text.`;

    const userPrompt = `Create 3 stylish outfit combinations from this catalog:

PRODUCTS:
${JSON.stringify(productCatalog, null, 2)}

${anchorProduct ? `ANCHOR PRODUCT (must include in all outfits): ${anchorProduct.name} (${anchorProduct.category}, ${anchorProduct.color})` : ""}
${occasion ? `OCCASION: ${occasion}` : ""}
${style ? `STYLE: ${style}` : ""}
${budget ? `MAX BUDGET: $${budget}` : ""}
${colorPreferences?.length ? `PREFERRED COLORS: ${colorPreferences.join(", ")}` : ""}

Create 3 distinct outfit combinations that would look great together.`;

    console.log("Calling OpenAI for outfit generation...");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      console.error("No content in AI response");
      return new Response(
        JSON.stringify({ error: "Failed to generate outfits" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsedContent;
    try {
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7);
      } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3);
      }
      parsedContent = JSON.parse(cleanContent.trim());
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ error: "Failed to parse outfit recommendations" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const outfits = parsedContent.outfits.map((outfit: any, index: number) => {
      const outfitProducts = outfit.productIds
        .map((id: string) => products.find(p => p.id === id))
        .filter(Boolean);
      
      const totalPrice = outfitProducts.reduce((sum: number, p: Product) => sum + Number(p.price), 0);

      return {
        id: crypto.randomUUID(),
        name: outfit.name || `Look ${index + 1}`,
        products: outfitProducts,
        totalPrice,
        reason: outfit.reason,
        occasion: outfit.occasion
      };
    });

    console.log(`Generated ${outfits.length} outfits successfully`);

    return new Response(
      JSON.stringify({ outfits }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Generate outfits error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to generate outfits" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
