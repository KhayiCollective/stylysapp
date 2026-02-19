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

interface SizeInfo {
  tops?: string;
  bottoms?: string;
  shoes?: string;
}

interface TryOnRequest {
  userImageBase64: string;
  outfitItems: OutfitItem[];
  bodyShape?: string;
  sizeInfo?: SizeInfo;
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
    const { userImageBase64, outfitItems, bodyShape, sizeInfo } = body;

    if (!userImageBase64 || !outfitItems?.length) {
      return new Response(
        JSON.stringify({ error: "User image and outfit items are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing virtual try-on request with", outfitItems.length, "outfit items");

    const itemInstructions = outfitItems.map((i, idx) => 
      `- Image ${idx + 2}: "${i.name}" (category: ${i.category}) — extract ONLY the ${i.category} garment from this image. The product image may show a model wearing a full outfit, but ONLY use the ${i.category} piece. Ignore all other clothing visible in this image.`
    ).join("\n");

    // Build body profile section if available
    const bodyShapeDescriptions: Record<string, string> = {
      "Hourglass": "balanced shoulders and hips with a well-defined, narrow waist",
      "Pear": "wider hips relative to shoulders, with a defined waist",
      "Apple": "broader midsection with slimmer legs, weight carried around the torso",
      "Rectangle": "similar shoulder, waist, and hip measurements with a straight silhouette",
      "Triangle": "narrower shoulders with wider hips, weight carried in the lower body",
      "Inverted Triangle": "broader shoulders tapering to narrower hips",
    };

    let bodyProfileSection = "";
    if (bodyShape || (sizeInfo && (sizeInfo.tops || sizeInfo.bottoms || sizeInfo.shoes))) {
      const parts: string[] = [];
      if (bodyShape) {
        const desc = bodyShapeDescriptions[bodyShape] || bodyShape.toLowerCase();
        parts.push(`- Body shape: ${bodyShape} (${desc})`);
      }
      const sizeParts: string[] = [];
      if (sizeInfo?.tops) sizeParts.push(`Tops ${sizeInfo.tops}`);
      if (sizeInfo?.bottoms) sizeParts.push(`Bottoms ${sizeInfo.bottoms}`);
      if (sizeInfo?.shoes) sizeParts.push(`Shoes ${sizeInfo.shoes}`);
      if (sizeParts.length) parts.push(`- Sizing: ${sizeParts.join(", ")}`);
      parts.push("- Adjust garment fit and draping to match this body type");
      if (sizeInfo?.tops) parts.push(`- Tops should fit as a size ${sizeInfo.tops} would on this body shape`);
      if (sizeInfo?.bottoms) parts.push(`- Bottoms should sit and drape as a size ${sizeInfo.bottoms} would on this figure`);

      bodyProfileSection = `\n\nBODY PROFILE:\n${parts.join("\n")}`;
      console.log("Body profile included:", bodyShape, sizeInfo);
    }

    const prompt = `You are a fashion visualization AI. Generate a single realistic photo showing the person in the uploaded photo wearing a complete outfit assembled from the following product images.

CRITICAL: Each product image may show a model wearing multiple garments, but each image represents ONLY ONE specific product for sale. You must extract only the garment matching the specified category from each image:

${itemInstructions}${bodyProfileSection}

Requirements:
1. Dress the person in ALL the extracted garments together as one cohesive outfit
2. Maintain the person's face, body shape, and pose from their original photo (Image 1)
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
        model: "google/gemini-2.5-flash-image",
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
