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

// Convert an external image URL to a base64 data URI
async function imageUrlToBase64(url: string): Promise<string> {
  // Already a data URI — pass through
  if (url.startsWith("data:")) return url;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`Failed to fetch image: ${url} — ${resp.status}`);
      return url; // fall back to raw URL
    }
    const contentType = resp.headers.get("content-type") || "image/jpeg";
    const buf = await resp.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    return `data:${contentType};base64,${b64}`;
  } catch (e) {
    console.error(`Error converting image to base64: ${url}`, e);
    return url; // fall back to raw URL
  }
}

const bodyShapeDescriptions: Record<string, string> = {
  "Hourglass": "balanced shoulders and hips with a well-defined, narrow waist",
  "Pear": "wider hips relative to shoulders, with a defined waist",
  "Apple": "broader midsection with slimmer legs, weight carried around the torso",
  "Rectangle": "similar shoulder, waist, and hip measurements with a straight silhouette",
  "Triangle": "narrower shoulders with wider hips, weight carried in the lower body",
  "Inverted Triangle": "broader shoulders tapering to narrower hips",
};

function buildPrompt(outfitItems: OutfitItem[], bodyShape?: string, sizeInfo?: SizeInfo): string {
  const itemInstructions = outfitItems.map((i, idx) =>
    `- Image ${idx + 2}: "${i.name}" (category: ${i.category}) — extract ONLY the ${i.category} garment from this image. The product image may show a model wearing a full outfit, but ONLY use the ${i.category} piece. Ignore all other clothing visible in this image.`
  ).join("\n");

  // Body profile section
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
  }

  return `You are a fashion retail product visualization AI. Create a realistic fashion visualization showing the person from Image 1 wearing a complete outfit assembled from the following product images. This is for fashion retail product visualization purposes.

CRITICAL: Each product image may show a model wearing multiple garments, but each image represents ONLY ONE specific product for sale. You must extract only the garment matching the specified category from each image:

${itemInstructions}${bodyProfileSection}

Requirements:
1. Dress the person in ALL the extracted garments together as one cohesive outfit
2. Maintain the person's face, body shape, and pose from their original photo (Image 1)
3. Natural lighting, realistic fabric draping, proper proportions
4. Professional fashion photography quality
5. Keep the original background or use a clean studio background

You MUST generate an image. Output the visualization image now.`;
}

function buildRetryPrompt(outfitItems: OutfitItem[]): string {
  const items = outfitItems.map(i => `"${i.name}" (${i.category})`).join(", ");
  return `Generate a fashion visualization image. Show the person from Image 1 wearing these clothing items: ${items}. Extract only the specified garment category from each product image. You MUST output an image. This is for fashion retail product visualization.`;
}

async function callAI(apiKey: string, contentParts: any[], model: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: contentParts }],
      modalities: ["image", "text"],
    }),
  });
  return response;
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
    if (bodyShape || sizeInfo) {
      console.log("Body profile included:", bodyShape, sizeInfo);
    }

    // Convert all external product image URLs to base64
    const convertedItems = await Promise.all(
      outfitItems.map(async (item) => {
        if (item.imageUrl && item.imageUrl.startsWith("http")) {
          console.log("Converting external image to base64:", item.imageUrl.substring(0, 80));
          const b64 = await imageUrlToBase64(item.imageUrl);
          return { ...item, imageUrl: b64 };
        }
        return item;
      })
    );

    const prompt = buildPrompt(convertedItems, bodyShape, sizeInfo);

    // Build content array: text prompt + user photo + all outfit item images
    const contentParts: any[] = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: userImageBase64 } },
    ];
    for (const item of convertedItems) {
      if (item.imageUrl) {
        contentParts.push({ type: "image_url", image_url: { url: item.imageUrl } });
      }
    }

    const models = ["google/gemini-3-pro-image-preview", "google/gemini-3-flash-preview", "openai/gpt-5"];
    let response: Response | null = null;
    let lastStatus = 500;

    for (const model of models) {
      console.log(`Trying model: ${model}`);
      response = await callAI(LOVABLE_API_KEY, contentParts, model);
      if (response.ok) break;
      const errorText = await response.text();
      console.error(`AI gateway error (${model}):`, response.status, errorText);
      lastStatus = response.status;
    }

    if (!response || !response.ok) {
      if (lastStatus === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (lastStatus === 402) {
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

    let aiResponse = await response.json();
    console.log("AI response keys:", JSON.stringify(Object.keys(aiResponse.choices?.[0]?.message || {})));

    let generatedImage = aiResponse.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    let textResponse = aiResponse.choices?.[0]?.message?.content;

    console.log("AI text response:", textResponse?.substring(0, 500));

    // Retry once if no image was generated
    if (!generatedImage) {
      console.log("No image on first attempt, retrying with simplified prompt...");

      const retryPrompt = buildRetryPrompt(convertedItems);
      const retryParts: any[] = [
        { type: "text", text: retryPrompt },
        { type: "image_url", image_url: { url: userImageBase64 } },
      ];
      for (const item of convertedItems) {
        if (item.imageUrl) {
          retryParts.push({ type: "image_url", image_url: { url: item.imageUrl } });
        }
      }

      for (const retryModel of models) {
        console.log(`Retry with model: ${retryModel}`);
        const retryResponse = await callAI(LOVABLE_API_KEY, retryParts, retryModel);
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          generatedImage = retryData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          const retryText = retryData.choices?.[0]?.message?.content;
          console.log("Retry response keys:", JSON.stringify(Object.keys(retryData.choices?.[0]?.message || {})));
          console.log("Retry text response:", retryText?.substring(0, 500));
          if (generatedImage) break;
          textResponse = retryText || textResponse;
        } else {
          const retryErr = await retryResponse.text();
          console.error(`Retry failed (${retryModel}):`, retryResponse.status, retryErr);
        }
      }
    }

    if (!generatedImage) {
      console.log("No image generated after retry");
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
