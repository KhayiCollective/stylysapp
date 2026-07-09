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

// Allowlist of trusted image hosts. Only HTTPS URLs from these domains may be fetched.
const ALLOWED_IMAGE_HOST_SUFFIXES = [
  "cdn.shopify.com",
  "shopify.com",
  "images.unsplash.com",
  "supabase.co",
  "supabase.in",
  "lovable.app",
  "lovable.dev",
];

function isPrivateHost(hostname: string): boolean {
  // Block common SSRF targets: localhost, link-local, private ranges, cloud metadata.
  if (!hostname) return true;
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower === "0.0.0.0" || lower.endsWith(".local") || lower.endsWith(".internal")) return true;
  if (lower === "169.254.169.254" || lower.startsWith("169.254.")) return true;
  if (lower.startsWith("10.") || lower.startsWith("127.")) return true;
  if (lower.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(lower)) return true;
  if (lower.startsWith("[::1]") || lower === "::1" || lower.startsWith("[fc") || lower.startsWith("[fd")) return true;
  return false;
}

function isAllowedImageUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    if (isPrivateHost(u.hostname)) return false;
    return ALLOWED_IMAGE_HOST_SUFFIXES.some(d => u.hostname === d || u.hostname.endsWith("." + d));
  } catch {
    return false;
  }
}

// Fetch an external image URL as a Blob (allowlist enforced)
async function imageUrlToBlob(url: string): Promise<{ blob: Blob; filename: string } | null> {
  if (!isAllowedImageUrl(url)) {
    console.warn(`Rejected image URL (not in allowlist): ${url.substring(0, 120)}`);
    return null;
  }
  try {
    const resp = await fetch(url, { redirect: "error" });
    if (!resp.ok) {
      console.error(`Failed to fetch image: ${url} — ${resp.status}`);
      return null;
    }
    const contentType = resp.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      console.warn(`Rejected non-image content-type: ${contentType}`);
      return null;
    }
    const buf = await resp.arrayBuffer();
    const ext = contentType.split("/")[1]?.split(";")[0] ?? "jpg";
    return { blob: new Blob([buf], { type: contentType }), filename: `garment.${ext}` };
  } catch (e) {
    console.error(`Error fetching image blob: ${url}`, e);
    return null;
  }
}

// Parse a base64 data URI into a Blob, extracting MIME type from the prefix.
function base64DataUriToBlob(dataUri: string): { blob: Blob; filename: string } {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw new Error("Invalid data URI format");
  const mimeType = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const ext = mimeType.split("/")[1]?.split(";")[0] ?? "jpg";
  return { blob: new Blob([bytes], { type: mimeType }), filename: `user.${ext}` };
}

// Resolve the user photo to a Blob regardless of whether it arrives as a
// data URI (fresh upload via FileReader) or an HTTPS URL (saved account photo).
async function userImageToBlob(value: string): Promise<{ blob: Blob; filename: string } | null> {
  if (value.startsWith("data:")) {
    try {
      return base64DataUriToBlob(value);
    } catch (e) {
      console.error("Failed to parse user image data URI:", e);
      return null;
    }
  }
  if (value.startsWith("https://")) {
    const result = await imageUrlToBlob(value);
    if (!result) return null;
    const ext = result.filename.split(".").pop() ?? "jpg";
    return { blob: result.blob, filename: `user.${ext}` };
  }
  console.error("Unrecognised user image format:", value.substring(0, 80));
  return null;
}

// Simple in-memory IP rate limiter (per-instance). Protects against credit abuse.
const rateBuckets = new Map<string, { count: number; reset: number }>();
function rateLimit(ip: string, limit = 10, windowMs = 60_000): boolean {
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

  return `You are a photorealistic virtual try-on system for fashion retail.

IMAGE 1 is the customer photo — this is your BASE IMAGE and IMMUTABLE reference.

ABSOLUTE RULES — DO NOT VIOLATE:
The person in Image 1 must remain EXACTLY the same. Preserve all visual characteristics with zero alterations:
- Face: identical facial features, expression, skin texture, complexion, blemishes. No beautification or smoothing.
- Hair: exact hairstyle, color, volume, and placement.
- Body: exact body shape, proportions, height, weight, build. No reshaping.
- Skin tone: exact match across all visible skin areas.
- Pose: identical posture, body angle, limb positions. Do NOT repose.
- Camera angle: same perspective, focal length, and framing.
- Lighting: same direction, intensity, color temperature, shadows on face and body.
- Background: completely unchanged — same environment, objects, depth of field, blur.

YOUR ONLY TASK: Remove the original clothing and replace it with the garments from the following product images.

GARMENT EXTRACTION — each product image shows ONE specific product:
${itemInstructions}

CLOTHING APPLICATION RULES:
- Strip the person's original clothing entirely before applying new garments.
- Dress the person from head to toe in the selected outfit only.
- Layer in correct order: base layers → mid-layers (shirts, pants) → outerwear → accessories.
- Align garments to the customer's actual body proportions:
  • Correct shoulder placement matching the person's shoulder width
  • Natural waist alignment following the person's waistline
  • Accurate sleeve length and arm fit
  • Proper garment length (hemlines, pant breaks)
- Simulate realistic fabric behavior:
  • Natural draping based on material (silk flows, denim holds shape, knits stretch)
  • Wrinkles and folds at joints (elbows, knees, waist)
  • Fabric tension where garments contact the body
- Shadow and light integration:
  • Garment shadows must match Image 1's lighting direction exactly
  • Add contact shadows where clothing meets skin (neckline, wrists, ankles)
  • Garment-to-garment shadows at overlap points (jacket over shirt)
- Seamless edge blending: no cutout borders, halos, color fringing, or unnatural seams where garments meet skin.
${bodyProfileSection}

OUTPUT REQUIREMENTS:
- Final image must be PHOTOREALISTIC — indistinguishable from a real photograph.
- Professional fashion photography quality.
- The viewer must believe this person was actually photographed wearing this exact outfit.
- Same resolution and aspect ratio as Image 1.

You MUST generate an image. Output the visualization image now.`;
}

function buildRetryPrompt(outfitItems: OutfitItem[]): string {
  const items = outfitItems.map(i => `"${i.name}" (${i.category})`).join(", ");
  return `Generate a photorealistic virtual try-on image. Image 1 is the customer's photo — this is the BASE IMAGE. The person must remain EXACTLY the same: preserve their face, skin tone, hair, pose, body shape, and background with ZERO alterations. Your ONLY task is to remove their current clothing and dress them in these items: ${items}. Extract only the specified garment from each product image. Fit garments realistically to the person's body — correct shoulder alignment, natural draping, proper lengths. Match the lighting and shadows from Image 1. The result must look like a real photograph of this person wearing this outfit. You MUST output an image.`;
}

async function callOpenAI(
  apiKey: string,
  userBlob: { blob: Blob; filename: string },
  garmentBlobs: Array<{ blob: Blob; filename: string }>,
  prompt: string,
): Promise<Response> {
  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("prompt", prompt);
  form.append("image[]", userBlob.blob, userBlob.filename);
  for (const g of garmentBlobs) form.append("image[]", g.blob, g.filename);
  return fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Per-IP rate limit to prevent credit abuse from unauthenticated callers.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
  if (!rateLimit(ip, 10, 60_000)) {
    return new Response(
      JSON.stringify({ error: "Too many try-on requests. Please wait a moment." }),
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

    // Convert user photo (data URI or saved HTTPS URL) to Blob for FormData
    const userBlob = await userImageToBlob(userImageBase64);
    if (!userBlob) {
      return new Response(
        JSON.stringify({ error: "Invalid user image format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch garment images as Blobs (allowlist enforced)
    const garmentBlobs: Array<{ blob: Blob; filename: string }> = [];
    for (const item of outfitItems) {
      if (item.imageUrl?.startsWith("http")) {
        console.log("Fetching garment image:", item.imageUrl.substring(0, 80));
        const result = await imageUrlToBlob(item.imageUrl);
        if (result) garmentBlobs.push(result);
      }
    }

    const prompt = buildPrompt(outfitItems, bodyShape, sizeInfo);
    console.log("Calling OpenAI image edits with", garmentBlobs.length, "garment image(s)");

    const response = await callOpenAI(OPENAI_API_KEY, userBlob, garmentBlobs, prompt);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("OpenAI API error:", response.status, errorBody);
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
    let generatedImage = aiResponse.data?.[0]?.b64_json
      ? `data:image/png;base64,${aiResponse.data[0].b64_json}`
      : null;
    console.log("OpenAI response — image received:", !!generatedImage);

    // Single retry with simplified prompt if no image returned
    if (!generatedImage) {
      console.log("No image on first attempt, retrying with simplified prompt...");
      const retryResponse = await callOpenAI(OPENAI_API_KEY, userBlob, garmentBlobs, buildRetryPrompt(outfitItems));
      if (retryResponse.ok) {
        const retryData = await retryResponse.json();
        generatedImage = retryData.data?.[0]?.b64_json
          ? `data:image/png;base64,${retryData.data[0].b64_json}`
          : null;
        console.log("Retry — image received:", !!generatedImage);
      } else {
        const retryErr = await retryResponse.text();
        console.error("Retry failed:", retryResponse.status, retryErr);
      }
    }

    if (!generatedImage) {
      console.log("No image generated after retry");
      return new Response(
        JSON.stringify({
          success: false,
          message: "Unable to generate virtual try-on image. Please try with a different photo.",
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
