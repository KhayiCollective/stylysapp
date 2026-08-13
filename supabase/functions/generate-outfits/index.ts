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

// Categories where only one item per outfit makes sense. "footwear" is the
// canonical value — "shoes" (used by some merchant catalogs) is normalized
// to it in effectiveCategory() below, not treated as a separate category.
const EXCLUSIVE_CATEGORIES = new Set([
  "tops", "bottoms", "dresses", "outerwear", "footwear",
]);

const CATEGORY_KEYWORDS: [string, RegExp][] = [
  ["dresses", /\bdress(es)?\b|\bgown\b|\bjumpsuit\b|\bromper\b/i],
  ["outerwear", /\bjacket\b|\bcoat\b|\bblazer\b|\bcardigan\b|\bparka\b|\bwindbreaker\b/i],
  ["footwear", /\bshoe(s)?\b|\bsandal(s)?\b|\bboot(s)?\b|\bsneaker(s)?\b|\bheel(s)?\b|\bflat(s)?\b|\bloafer(s)?\b/i],
  ["bottoms", /\bpant(s)?\b|\btrouser(s)?\b|\bjean(s)?\b|\bskirt\b|\bshort(s)?\b|\blegging(s)?\b/i],
  ["tops", /\btop\b|\bshirt\b|\bblouse\b|\btee\b|\bt-shirt\b|\bsweater\b|\bknit\b|\btank\b|\bcami\b/i],
];

// Falls back to keyword-matching the name when the stored category is
// missing/unrecognized, so real garment type is still detected on
// uncategorized catalogs (matches the logic in widget-outfits).
function effectiveCategory(item: { category?: string; name?: string }): string {
  const raw = (item.category || "").toLowerCase().trim();
  const normalized = raw === "shoes" ? "footwear" : raw;
  const haystack = `${item.name || ""}`.toLowerCase();
  let keywordMatch: string | null = null;
  for (const [cat, re] of CATEGORY_KEYWORDS) {
    if (re.test(haystack)) { keywordMatch = cat; break; }
  }

  if (EXCLUSIVE_CATEGORIES.has(normalized)) {
    // Data-quality guard: a product can be stored with the wrong category
    // (confirmed live — a blouse saved with category "shoes"), which
    // otherwise makes it a phantom match for that category forever. If the
    // name unambiguously signals a DIFFERENT category than what's stored,
    // trust the name over the stored value.
    if (keywordMatch && keywordMatch !== normalized) return keywordMatch;
    return normalized;
  }
  if (keywordMatch) return keywordMatch;
  return normalized || "uncategorized";
}

// Step 1: dedupe repeated ids + resolve dress-vs-separates conflicts + cap
// exclusive categories to one item each.
function dedupeOutfitItems(rawItems: Product[]): Product[] {
  const seenIds = new Set<string>();
  let items = rawItems.filter(item => {
    if (seenIds.has(item.id)) return false;
    seenIds.add(item.id);
    return true;
  });

  const hasDress = items.some(i => effectiveCategory(i) === "dresses");
  if (hasDress) {
    items = items.filter(i => {
      const cat = effectiveCategory(i);
      return cat !== "tops" && cat !== "bottoms";
    });
  }

  const seenCats = new Set<string>();
  return items.filter(item => {
    const cat = effectiveCategory(item);
    if (!EXCLUSIVE_CATEGORIES.has(cat)) return true;
    if (seenCats.has(cat)) return false;
    seenCats.add(cat);
    return true;
  });
}

// Step 2: if dedup dropped the outfit below minItems, backfill from the full
// catalog rather than leaving a too-short outfit or discarding it outright.
// `globalUsedIds`, when provided, is shared across every outfit being
// backfilled in the same response so outfit 2's backfill can't grab the exact
// item outfit 1's backfill just used (matches widget-outfits).
function backfillOutfitItems(items: Product[], minItems: number, maxItems: number, catalog: Product[], globalUsedIds?: Set<string>): Product[] {
  if (items.length >= minItems) return items.slice(0, maxItems);

  const result = [...items];
  const usedIds = new Set(result.map(i => i.id));
  const presentCats = new Set(result.map(i => effectiveCategory(i)));
  const hasDress = presentCats.has("dresses");

  const fillOrder: string[] = [];
  if (!hasDress) {
    if (!presentCats.has("tops")) fillOrder.push("tops");
    if (!presentCats.has("bottoms")) fillOrder.push("bottoms");
  }
  fillOrder.push("outerwear", "footwear", "accessories", "accessories");

  for (const cat of fillOrder) {
    if (result.length >= minItems) break;
    if (EXCLUSIVE_CATEGORIES.has(cat) && presentCats.has(cat)) continue;
    if (!EXCLUSIVE_CATEGORIES.has(cat) && result.filter(i => effectiveCategory(i) === cat).length >= 2) continue;

    const candidate = catalog.find(p => !usedIds.has(p.id) && !globalUsedIds?.has(p.id) && effectiveCategory(p) === cat);
    if (!candidate) continue;

    result.push(candidate);
    usedIds.add(candidate.id);
    globalUsedIds?.add(candidate.id);
    presentCats.add(cat);
  }

  return result.slice(0, maxItems);
}

// The prompt tells the model to include the anchor product in every outfit,
// but it doesn't reliably comply (confirmed live: 2 of 3 preview outfits had
// it, one didn't). Force it in server-side — drop whatever would conflict
// with it (same exclusive category, or the opposite half of the
// dress-vs-separates base), then insert the anchor.
function ensureAnchorItem(items: Product[], anchor: Product, maxItems: number): Product[] {
  if (items.some(i => i.id === anchor.id)) return items;
  const anchorCat = effectiveCategory(anchor);
  const filtered = items.filter(i => {
    const cat = effectiveCategory(i);
    if (EXCLUSIVE_CATEGORIES.has(anchorCat) && cat === anchorCat) return false;
    if (anchorCat === "dresses" && (cat === "tops" || cat === "bottoms")) return false;
    if ((anchorCat === "tops" || anchorCat === "bottoms") && cat === "dresses") return false;
    return true;
  });
  return [anchor, ...filtered].slice(0, maxItems);
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

    // Shuffled so refreshing the preview doesn't keep surfacing the same
    // first-listed items every time (matches widget-outfits).
    const shuffledProducts = [...products];
    for (let i = shuffledProducts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledProducts[i], shuffledProducts[j]] = [shuffledProducts[j], shuffledProducts[i]];
    }
    const productCatalog = shuffledProducts.map(p => ({
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

    // Dedupe (dress-vs-separates conflicts, repeated ids, duplicate
    // categories) and force in the anchor for every outfit first, so we know
    // up front what every outfit already has before any backfill runs.
    const preBackfill = parsedContent.outfits.map((outfit: any, index: number) => {
      const rawProducts: Product[] = (outfit.productIds || [])
        .map((id: string) => products.find(p => p.id === id))
        .filter(Boolean);
      const deduped = dedupeOutfitItems(rawProducts);
      const withAnchor = anchorProduct ? ensureAnchorItem(deduped, anchorProduct, maxItems) : deduped;
      return { outfit, withAnchor, index };
    });

    // Shared across all 3 outfits so backfill for outfit 2 can't reach for the
    // same item backfill just gave outfit 1. `shuffledProducts` (already
    // randomized above for the AI's view) is reused here too instead of the
    // raw request-order `products` array, so backfill doesn't always land on
    // the same first-in-order candidate for a given category.
    const globalUsedIds = new Set<string>(preBackfill.flatMap(({ withAnchor }) => withAnchor.map(i => i.id)));

    const outfits = preBackfill.map(({ outfit, withAnchor, index }) => {
      // Backfill from the full catalog if dedup dropped the outfit below
      // minItems — mirrors widget-outfits' live validation so this admin
      // preview matches what customers actually see.
      const outfitProducts = backfillOutfitItems(withAnchor, minItems, maxItems, shuffledProducts, globalUsedIds);

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
