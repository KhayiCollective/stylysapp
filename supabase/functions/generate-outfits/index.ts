import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

interface OutfitRequest {
  products: Product[];
  anchorProductId?: string;
  occasion?: string;
  style?: string;
  budget?: number;
  colorPreferences?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: OutfitRequest = await req.json();
    const { products, anchorProductId, occasion, style, budget, colorPreferences } = body;

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ error: "No products provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find anchor product if specified
    const anchorProduct = anchorProductId 
      ? products.find(p => p.id === anchorProductId) 
      : null;

    // Prepare product catalog for AI
    const productCatalog = products.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      category: p.category,
      color: p.color || "unknown",
      fit: p.fit || "regular"
    }));

    const systemPrompt = `You are STYLYS, an expert AI fashion stylist. Your job is to create cohesive, stylish outfit combinations from a product catalog.

RULES:
1. Each outfit must have 2-5 items that work together aesthetically
2. Consider color harmony - complementary or analogous colors work best
3. Balance categories - typically a top, bottom, and optional accessories/layers
4. Stay within budget if specified
5. Match the occasion/style if specified
6. If an anchor product is specified, build the outfit around it

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

    console.log("Calling Lovable AI for outfit generation...");

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

    // Parse AI response - handle potential markdown code blocks
    let parsedContent;
    try {
      // Remove markdown code blocks if present
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

    // Build full outfit objects with product details
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
