import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OutfitItem {
  name: string;
  imageUrl: string;
  category: string;
}

interface TryOnRequest {
  userImageBase64: string;
  outfitItems: OutfitItem[];
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

    const body: TryOnRequest = await req.json();
    const { userImageBase64, outfitItems } = body;

    if (!userImageBase64 || !outfitItems?.length) {
      return new Response(
        JSON.stringify({ error: "User image and outfit items are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing virtual try-on request with", outfitItems.length, "outfit items");

    const outfitDescription = outfitItems.map(i => `${i.name} (${i.category})`).join(", ");

    const prompt = `You are a fashion visualization AI. Generate a single realistic photo showing the person in the uploaded photo wearing this complete outfit: ${outfitDescription}.

Requirements:
1. The person should be wearing ALL the items together as one cohesive outfit
2. Maintain the person's face, body shape, and pose from their original photo
3. Natural lighting, realistic fabric draping, proper proportions
4. Professional fashion photography quality
5. Keep the original background or use a clean studio background

Generate the composite image now.`;

    // Build content array: text prompt + user photo + all outfit item images
    const contentParts: any[] = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: userImageBase64 } },
    ];

    for (const item of outfitItems) {
      if (item.imageUrl) {
        contentParts.push({ type: "image_url", image_url: { url: item.imageUrl } });
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          {
            role: "user",
            content: contentParts,
          }
        ],
        modalities: ["image", "text"]
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
        JSON.stringify({ error: "Virtual try-on service temporarily unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    console.log("AI response received");

    const generatedImage = aiResponse.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const textResponse = aiResponse.choices?.[0]?.message?.content;

    if (!generatedImage) {
      console.log("No image generated, returning text response");
      return new Response(
        JSON.stringify({ 
          success: false,
          message: textResponse || "Unable to generate virtual try-on image. Please try with a different photo.",
          tip: "For best results, use a full-body photo with good lighting and a simple background."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Virtual try-on image generated successfully");

    return new Response(
      JSON.stringify({ 
        success: true,
        resultImage: generatedImage,
        message: textResponse
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Virtual try-on error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to process virtual try-on" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
