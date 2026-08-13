import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getJwtKey() {
  const secret = Deno.env.get("WIDGET_JWT_SECRET");
  if (!secret) throw new Error("WIDGET_JWT_SECRET not configured");
  const encoder = new TextEncoder();
  return await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function verifyCustomerJwt(req: Request): Promise<{ sub: string; brand_id: string; email: string; customer_id?: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const key = await getJwtKey();
    const payload = await verify(authHeader.replace("Bearer ", ""), key);
    return { sub: payload.sub as string, brand_id: payload.brand_id as string, email: payload.email as string, customer_id: payload.customer_id as string | undefined };
  } catch {
    return null;
  }
}

function getSupabaseAdmin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

// Categories where only one item per outfit makes sense. "footwear" is the
// canonical value — "shoes" (used by some merchant catalogs, confirmed via
// production logs showing category: "shoes" for this brand's footwear) is
// normalized to it in effectiveCategory() below, not treated as separate.
const EXCLUSIVE_CATEGORIES = new Set([
  "tops", "bottoms", "dresses", "outerwear", "footwear",
]);

// Many merchant catalogs have products with category = "uncategorized" or
// blank. Previously those items skipped ALL dedup, so e.g. two dresses both
// left uncategorized could stack into one outfit undetected — this was the
// exact bug reported (multiple dresses + a jacket in a single look). Instead
// of trusting the raw `category` field, fall back to keyword-matching the
// product_type and name so real garment type is still detected even when the
// merchant hasn't categorized the product.
const CATEGORY_KEYWORDS: [string, RegExp][] = [
  ["dresses", /\bdress(es)?\b|\bgown\b|\bjumpsuit\b|\bromper\b/i],
  ["outerwear", /\bjacket\b|\bcoat\b|\bblazer\b|\bcardigan\b|\bparka\b|\bwindbreaker\b/i],
  ["footwear", /\bshoe(s)?\b|\bsandal(s)?\b|\bboot(s)?\b|\bsneaker(s)?\b|\bheel(s)?\b|\bflat(s)?\b|\bloafer(s)?\b/i],
  ["bottoms", /\bpant(s)?\b|\btrouser(s)?\b|\bjean(s)?\b|\bskirt\b|\bshort(s)?\b|\blegging(s)?\b/i],
  ["tops", /\btop\b|\bshirt\b|\bblouse\b|\btee\b|\bt-shirt\b|\bsweater\b|\bknit\b|\btank\b|\bcami\b/i],
];

function effectiveCategory(item: { category?: string; product_type?: string; name?: string }): string {
  const raw = (item.category || "").toLowerCase().trim();
  const normalized = raw === "shoes" ? "footwear" : raw;
  if (EXCLUSIVE_CATEGORIES.has(normalized)) return normalized;
  const haystack = `${item.product_type || ""} ${item.name || ""}`.toLowerCase();
  for (const [cat, re] of CATEGORY_KEYWORDS) {
    if (re.test(haystack)) return cat;
  }
  return normalized || "uncategorized";
}

// Step 1: dedupe. Removes exact repeated product ids, resolves the
// dress-vs-separates conflict (a dress replaces top+bottom, so drop any
// separate top/bottom once a dress is present), and caps every exclusive
// category to one item. This alone can shrink an outfit well below
// minItems — e.g. a 4-item AI outfit that had 2 dresses + a jacket + a
// top collapses to just the 1 dress + 1 jacket once cleaned up. That's
// handled by backfillOutfit() below, not by discarding the outfit.
function dedupeAndClamp(rawOutfits: any[], maxItems: number): any[] {
  return rawOutfits
    .map(outfit => {
      const seenIds = new Set<string>();
      let items = (outfit.items as any[]).filter(item => {
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
      const deduped = items.filter(item => {
        const cat = effectiveCategory(item);
        if (!EXCLUSIVE_CATEGORIES.has(cat)) return true;
        if (seenCats.has(cat)) return false;
        seenCats.add(cat);
        return true;
      });

      return { ...outfit, items: deduped.slice(0, maxItems) };
    })
    .filter(outfit => outfit.items.length > 0);
}

// Shared shape for turning a raw catalog product into an outfit line item —
// used by both backfillOutfit() and ensureAnchor() below.
function toOutfitItem(p: any): any {
  return {
    id: p.id,
    name: p.name,
    price: Number(p.price),
    image_url: p.image_url,
    category: p.category,
    product_type: p.product_type,
    color: p.color,
    fit: p.fit,
    shopify_variant_id: p._matchedVariantId || p.shopify_variant_id || null,
    in_stock: p._sizeAvailable !== false && p.inventory_status === "in_stock",
    available: p._sizeAvailable !== false && p.inventory_status === "in_stock",
  };
}

// Step 2: backfill. If dedup left an outfit below minItems, pull additional
// items directly from the full catalog (not just what the AI picked) to
// close the gap — completing a missing top/bottom half first, then adding
// outerwear/footwear/accessories — before ever discarding an outfit for
// being too short.
function backfillOutfit(outfit: any, minItems: number, maxItems: number, catalog: any[]): any {
  if (outfit.items.length >= minItems) return outfit;

  const items = [...outfit.items];
  const usedIds = new Set(items.map((i: any) => i.id));
  const presentCats = new Set(items.map((i: any) => effectiveCategory(i)));
  const hasDress = presentCats.has("dresses");

  const fillOrder: string[] = [];
  if (!hasDress) {
    if (!presentCats.has("tops")) fillOrder.push("tops");
    if (!presentCats.has("bottoms")) fillOrder.push("bottoms");
  }
  fillOrder.push("outerwear", "footwear", "accessories", "accessories");

  for (const cat of fillOrder) {
    if (items.length >= minItems) break;
    if (EXCLUSIVE_CATEGORIES.has(cat) && presentCats.has(cat)) continue;
    if (!EXCLUSIVE_CATEGORIES.has(cat) && items.filter((i: any) => effectiveCategory(i) === cat).length >= 2) continue;

    const candidate = catalog.find((p: any) => !usedIds.has(p.id) && effectiveCategory(p) === cat);
    if (!candidate) continue;

    items.push(toOutfitItem(candidate));
    usedIds.add(candidate.id);
    presentCats.add(cat);
  }

  const clamped = items.slice(0, maxItems);
  return { ...outfit, items: clamped, totalPrice: clamped.reduce((s: number, p: any) => s + Number(p.price), 0) };
}

// Step 1.5 (only runs when an anchor product was requested): the AI is told
// to include the anchor in every outfit but doesn't reliably comply — the
// admin Rules-page preview showed 2 of 3 outfits with the anchor and one
// without it. Force it in server-side: drop whatever would conflict with it
// (same exclusive category, or the opposite half of the dress-vs-separates
// base), then insert the anchor.
function ensureAnchor(outfit: any, anchor: any, maxItems: number): any {
  if (outfit.items.some((i: any) => i.id === anchor.id)) return outfit;

  const anchorItem = toOutfitItem(anchor);
  const anchorCat = effectiveCategory(anchorItem);

  const items = outfit.items.filter((i: any) => {
    const cat = effectiveCategory(i);
    if (EXCLUSIVE_CATEGORIES.has(anchorCat) && cat === anchorCat) return false;
    if (anchorCat === "dresses" && (cat === "tops" || cat === "bottoms")) return false;
    if ((anchorCat === "tops" || anchorCat === "bottoms") && cat === "dresses") return false;
    return true;
  });

  const withAnchor = [anchorItem, ...items].slice(0, maxItems);
  return { ...outfit, items: withAnchor, totalPrice: withAnchor.reduce((s: number, p: any) => s + Number(p.price), 0) };
}

// Step 3: discard outfits that still don't meet the merchant's rules after
// dedup + backfill (e.g. the catalog genuinely doesn't have enough distinct
// pieces to hit minItems, or a required category has zero matching stock).
// "tops", "bottoms", "dresses" are BASE categories — an outfit has exactly
// one base (a dress, or a top+bottom pair), never both, by design (see
// dedupeAndClamp). So if a merchant checks any of these as "required" on the
// Rules page, that should mean "every outfit needs a complete base", not
// "every outfit needs a top AND a bottom AND a dress simultaneously" — the
// latter is structurally impossible given the dress-vs-separates rule and
// would silently fail every outfit. Treat them as satisfied by EITHER a
// dress OR a top+bottom pair. Every other required category (outerwear,
// footwear, accessories, etc.) is still a strict requirement.
const BASE_CATEGORIES = new Set(["tops", "bottoms", "dresses"]);

function filterByRequirements(outfits: any[], minItems: number, requiredCats: string[]): any[] {
  // Normalize "shoes" -> "footwear" here too — the Rules page stores the
  // literal checkbox value ("Shoes"), but effectiveCategory() always resolves
  // items to "footwear". Without this, a merchant who requires "Shoes" would
  // have every single outfit fail this check (presentCats never contains the
  // literal string "shoes"), silently forcing every request into the relaxed
  // fallback path further down.
  const normalizedRequired = requiredCats.map(c => {
    const v = c.toLowerCase().trim();
    return v === "shoes" ? "footwear" : v;
  });
  const requiredBase = normalizedRequired.filter(c => BASE_CATEGORIES.has(c));
  const requiredOther = normalizedRequired.filter(c => !BASE_CATEGORIES.has(c));

  return outfits.filter(outfit => {
    if (outfit.items.length < minItems) {
      console.log(`[validate] outfit "${outfit.name}" dropped: ${outfit.items.length} items < minItems ${minItems}`);
      return false;
    }
    const presentCats = new Set<string>(outfit.items.map((i: any) => effectiveCategory(i)));

    if (requiredBase.length > 0) {
      const hasDressBase = presentCats.has("dresses");
      const hasSeparatesBase = presentCats.has("tops") && presentCats.has("bottoms");
      if (!hasDressBase && !hasSeparatesBase) {
        console.log(`[validate] outfit "${outfit.name}" dropped: no complete base (needs a dress, or a top+bottom pair)`);
        return false;
      }
    }

    for (const rc of requiredOther) {
      if (!presentCats.has(rc)) {
        console.log(`[validate] outfit "${outfit.name}" dropped: missing required category "${rc}"`);
        return false;
      }
    }
    return true;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabase = getSupabaseAdmin();

    // --- GENERATE (public, just needs brand_id OR shop) ---
    if (path === "generate" && req.method === "POST") {
      const body = await req.json();
      const { anchor_product_id, occasion, style, customer_profile, quiz_session, rules } = body;
      let brand_id: string | undefined = body.brand_id;
      const shop: string | undefined = body.shop;

      // SECURITY / CORRECTNESS: if a shop domain is provided, ALWAYS re-resolve
      // brand_id server-side from brands.shopify_store_domain. This makes the
      // function immune to stale/cached/spoofed brand_ids from the client and
      // guarantees each merchant only ever queries their own products.
      if (shop) {
        const shopDomain = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;
        const { data: brandRow } = await supabase
          .from("brands")
          .select("id")
          .eq("shopify_store_domain", shopDomain)
          .maybeSingle();
        if (brandRow?.id) {
          if (brand_id && brand_id !== brandRow.id) {
            console.log("[widget-outfits/generate] overriding client brand_id with shop-resolved brand", {
              client_brand_id: brand_id, resolved_brand_id: brandRow.id, shop: shopDomain,
            });
          }
          brand_id = brandRow.id;
        } else {
          console.log("[widget-outfits/generate] shop not found in brands table", { shop: shopDomain });
        }
      }

      if (!brand_id) return json({ error: "brand_id or shop is required" }, 400);

      // Run inventory-rule lookup and products fetch in parallel.
      // Products are always fetched without an inventory_status filter so both
      // queries can start simultaneously; the in-stock gate is applied in JS below.
      const [inStockRuleResult, productsResult] = await Promise.all([
        supabase
          .from("rules")
          .select("enabled")
          .eq("brand_id", brand_id)
          .eq("category", "inventory")
          .eq("name", "In-Stock Only")
          .maybeSingle(),
        supabase
          .from("products")
          .select("id, name, price, image_url, category, color, fit, shopify_variant_id, shopify_product_id, product_type, tags, collections, variants_json, images_json, inventory_status")
          .eq("brand_id", brand_id)
          .limit(400),
      ]);
      const inStockOnly = inStockRuleResult.data?.enabled !== false; // default ON if rule missing
      const { data: allProducts, error: prodErr } = productsResult;
      // Apply in-stock filter in JS — identical final set to the previous DB-filtered query.
      const rawProducts = inStockOnly
        ? (allProducts || []).filter((p: any) => p.inventory_status === "in_stock")
        : allProducts;

      console.log("[widget-outfits/generate] request", {
        brand_id, anchor_product_id,
        raw_count: rawProducts?.length || 0,
        prod_err: prodErr?.message || null,
      });

      if (prodErr || !rawProducts?.length) {
        return json({ error: "No products available" }, 404);
      }

      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      if (!OPENAI_API_KEY) return json({ error: "AI service not configured" }, 500);

      // ---- Parse budget from quiz (e.g. "Under $100", "$100–$250", "No limit") ----
      const parseBudget = (b?: string): { min: number; max: number } | null => {
        if (!b) return null;
        const s = b.toLowerCase().replace(/[,\s]/g, "");
        if (s.includes("nolimit") || s.includes("any")) return null;
        const nums = (b.match(/\d+(?:\.\d+)?/g) || []).map(Number);
        if (s.startsWith("under") && nums.length >= 1) return { min: 0, max: nums[0] };
        if (s.startsWith("over") && nums.length >= 1) return { min: nums[0], max: Infinity };
        if (nums.length >= 2) return { min: nums[0], max: nums[1] };
        if (nums.length === 1) return { min: 0, max: nums[0] };
        return null;
      };
      const budgetRange = parseBudget(quiz_session?.budget);

      // ---- Customer sizes for variant availability filtering ----
      const customerSizes = new Set<string>();
      if (customer_profile?.size_info) {
        for (const v of Object.values(customer_profile.size_info as Record<string, unknown>)) {
          if (typeof v === "string" && v.trim()) customerSizes.add(v.trim().toLowerCase());
        }
      }

      // Treat as a clothing size only if it matches typical apparel size tokens.
      // Otherwise the variant "size" is really a color/style label (e.g. "Tortoise",
      // "Default Title") and we should NOT exclude the product on that basis.
      const APPAREL_SIZE = /^(xxs|xs|s|m|l|xl|xxl|xxxl|\d{1,3})$/i;
      const isApparelSize = (v: unknown) => typeof v === "string" && APPAREL_SIZE.test(v.trim());

      const productHasAvailableSize = (p: any): { available: boolean; matchedVariantId: string | null } => {
        const variants: any[] = Array.isArray(p.variants_json) ? p.variants_json : [];
        if (!variants.length) return { available: true, matchedVariantId: p.shopify_variant_id || null };
        const anyAvail = variants.some(v => v?.available !== false);
        const firstAvail = variants.find(v => v?.available !== false) || variants[0];
        const fallbackId = firstAvail?.variant_id || p.shopify_variant_id || null;

        if (!customerSizes.size) {
          return { available: anyAvail, matchedVariantId: fallbackId };
        }
        // Only enforce size matching when this product's variants actually use apparel sizes.
        const productUsesApparelSizes = variants.some(v => isApparelSize(v?.size));
        if (!productUsesApparelSizes) {
          return { available: anyAvail, matchedVariantId: fallbackId };
        }
        const match = variants.find(v => v?.available !== false && v?.size && customerSizes.has(String(v.size).toLowerCase()));
        if (match) return { available: true, matchedVariantId: match.variant_id || fallbackId };
        return { available: false, matchedVariantId: null };
      };

      // ---- Apply server-side filters with logging + graceful fallbacks ----
      const enriched = rawProducts.map((p: any) => {
        const sz = productHasAvailableSize(p);
        return { ...p, _matchedVariantId: sz.matchedVariantId, _sizeAvailable: sz.available };
      });
      const sizeOk = enriched.filter((p: any) => p._sizeAvailable);
      const budgetOk = budgetRange
        ? sizeOk.filter((p: any) => (Number(p.price) || 0) <= budgetRange.max)
        : sizeOk;

      console.log("[widget-outfits/generate] filter stats", {
        brand_id,
        raw: rawProducts.length,
        after_size_filter: sizeOk.length,
        after_budget_filter: budgetOk.length,
        customer_sizes: Array.from(customerSizes),
        budget: budgetRange,
      });

      // Graceful fallback: never return empty just because filters were too strict.
      let filtered = budgetOk;
      if (!filtered.length && sizeOk.length) {
        console.log("[widget-outfits/generate] budget filter eliminated all products — falling back to size-only pool");
        filtered = sizeOk;
      }
      if (!filtered.length && enriched.length) {
        console.log("[widget-outfits/generate] size filter eliminated all products — falling back to full in-stock pool");
        filtered = enriched.map((p: any) => ({ ...p, _matchedVariantId: p._matchedVariantId || p.shopify_variant_id || null }));
      }

      // Always keep anchor in pool even if filtered out
      let anchorProduct: any = null;
      if (anchor_product_id) {
        anchorProduct = rawProducts.find((p: any) => p.id === anchor_product_id);
        if (!anchorProduct && anchor_product_id.includes("gid://")) {
          const numericId = anchor_product_id.split("/").pop();
          if (numericId) anchorProduct = rawProducts.find((p: any) => p.shopify_product_id === numericId);
        }
        if (anchorProduct && !filtered.find((p: any) => p.id === anchorProduct.id)) {
          const sz = productHasAvailableSize(anchorProduct);
          filtered.unshift({ ...anchorProduct, _matchedVariantId: sz.matchedVariantId || anchorProduct.shopify_variant_id || null, _sizeAvailable: true });
        }
      }

      // Build the 60-item pool the AI actually sees. Previously this was
      // `filtered.slice(0, 60)` — always the same fixed first-60 rows in
      // whatever order the DB returned them, every single request. With a
      // ~160-item catalog that meant ~100 products (and potentially entire
      // thin categories like footwear/accessories) never got a chance to
      // appear at all, which is why outfits kept repeating and sometimes
      // came back with no shoes. Now: guarantee a handful of footwear/
      // accessories/outerwear candidates are always in the pool (a pure
      // random sample from 160 items could easily miss an 8-item category),
      // then fill the rest with a random sample of everything else so
      // different requests genuinely see different products, not just a
      // different order of the same ones.
      const shuffleArray = <T,>(arr: T[]): T[] => {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
      };
      const POOL_SIZE = 60;
      const GUARANTEED_PER_CATEGORY = 6;
      const byCategory = new Map<string, any[]>();
      for (const p of filtered) {
        const cat = effectiveCategory(p);
        if (!byCategory.has(cat)) byCategory.set(cat, []);
        byCategory.get(cat)!.push(p);
      }
      const guaranteed: any[] = [];
      const guaranteedIds = new Set<string>();
      for (const cat of ["footwear", "accessories", "outerwear"]) {
        for (const item of shuffleArray(byCategory.get(cat) || []).slice(0, GUARANTEED_PER_CATEGORY)) {
          if (!guaranteedIds.has(item.id)) {
            guaranteed.push(item);
            guaranteedIds.add(item.id);
          }
        }
      }
      const remainderPool = shuffleArray(filtered.filter((p: any) => !guaranteedIds.has(p.id)));
      const products = [...guaranteed, ...remainderPool].slice(0, POOL_SIZE);
      if (!products.length) {
        console.log("[widget-outfits/generate] no products available", { brand_id, raw: rawProducts.length });
        return json({ error: "No products available" }, 404);
      }

      // Diagnostic: how many candidates does the backfill step actually have
      // per category? If e.g. footwear/accessories come back at 0 here, that's
      // why outfits can't be topped up to minItems — the catalog pool itself
      // lacks that category, not a bug in the dedup/backfill logic.
      const categoryBreakdown = (list: any[]) => {
        const counts: Record<string, number> = {};
        for (const p of list) {
          const c = effectiveCategory(p);
          counts[c] = (counts[c] || 0) + 1;
        }
        return counts;
      };
      console.log("[widget-outfits/generate] category pool", {
        brand_id,
        in_stock_only: inStockOnly,
        raw_all_products: allProducts?.length || 0,
        raw_after_instock_filter: rawProducts.length,
        final_pool_size: products.length,
        final_pool_by_category: categoryBreakdown(products),
      });

      // ---- Catalog payload for the AI (with product_type, tags, collections) ----
      // `products` is already a randomized sample (see above), but it's built
      // in category-priority blocks (footwear/accessories/outerwear first) —
      // reshuffle just the presentation order so the model doesn't always see
      // those categories listed first.
      const productCatalog = shuffleArray(products).map((p: any) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        product_type: p.product_type || null,
        tags: Array.isArray(p.tags) ? p.tags.slice(0, 10) : [],
        collections: Array.isArray(p.collections) ? p.collections.map((c: any) => c?.title).filter(Boolean).slice(0, 5) : [],
        color: p.color || "unknown",
        fit: p.fit || null,
        price: Number(p.price),
      }));

      // Build personalization context
      let personalization = "";
      if (customer_profile) {
        const parts: string[] = [];
        if (customer_profile.body_shape) parts.push(`Body shape: ${customer_profile.body_shape}`);
        if (customerSizes.size) parts.push(`Sizes: ${Array.from(customerSizes).join(", ")}`);
        if (customer_profile.style_preferences?.length) parts.push(`Style preferences: ${customer_profile.style_preferences.join(", ")}`);
        if (customer_profile.preferred_colors?.length) parts.push(`Preferred colors: ${customer_profile.preferred_colors.join(", ")}`);
        if (customer_profile.avoided_colors?.length) parts.push(`Colors to avoid: ${customer_profile.avoided_colors.join(", ")}`);
        if (customer_profile.occasions?.length) parts.push(`Usual occasions: ${customer_profile.occasions.join(", ")}`);
        if (parts.length) personalization += `\nCUSTOMER PROFILE:\n${parts.join("\n")}`;
      }
      if (quiz_session) {
        const qParts: string[] = [];
        if (quiz_session.occasion) qParts.push(`Today's occasion: ${quiz_session.occasion}`);
        if (quiz_session.colorMood) qParts.push(`Color mood / palette: ${quiz_session.colorMood}`);
        if (quiz_session.formality) qParts.push(`Formality (dressy↔casual): ${quiz_session.formality}`);
        if (quiz_session.budget) {
          qParts.push(`Budget: ${quiz_session.budget}${budgetRange ? ` (per item ≤ $${budgetRange.max})` : ""}`);
        }
        if (qParts.length) personalization += `\nSESSION PREFERENCES:\n${qParts.join("\n")}`;
      }

      // Composition rules (required/optional categories, min/max items)
      const composition = rules || {};
      const minItems = composition.minItems ?? 3;
      const maxItems = composition.maxItems ?? 5;
      const requiredCats: string[] = composition.requiredCategories ?? ["tops", "bottoms"];
      const optionalCats: string[] = composition.optionalCategories ?? ["shoes", "accessories", "bags", "jewelry", "hats", "sunglasses"];

      const systemPrompt = `You are STYLYS, an expert AI fashion stylist. Build cohesive complete outfits ONLY from the provided catalog.
RULES:
1. Each outfit has ${minItems}-${maxItems} items that work together aesthetically.
2. Composition — every outfit needs exactly ONE base: either (a) one item from "dresses", OR (b) one item from "tops" AND one item from "bottoms". A dress already covers top and bottom — never combine a dress with a separate top or bottom, and never use two items from the same category (two dresses, two jackets, two tops, etc). The merchant also requires these categories whenever relevant: ${requiredCats.join(", ")} — for "tops"/"bottoms"/"dresses" this just means "pick a complete base" (a dress on its own already counts), it does NOT mean include a dress AND a separate top AND a separate bottom together. Add optional categories on top of the base when available: ${optionalCats.join(", ")}.
3. Use product_type, tags, and collections to classify pieces.
4. OCCASION & FORMALITY — this is the customer's primary signal for which pieces to pick, weight it heavily. Treat each occasion as genuinely distinct — do not default to the same "safe" combination for different occasions:
   - Workout / gym / active → activewear only (leggings, sports bras/tanks, joggers, sneakers). No dresses, blazers, or heels.
   - Everyday / Casual → simple, comfortable separates, casual footwear, minimal accessories.
   - Brunch → a lighter, feminine daytime look — dresses/skirts/soft separates, sandals or low heels, delicate accessories.
   - Weekend Out / Weekend Getaway → relaxed but photo-ready — flowy or textured pieces, comfortable low-maintenance footwear.
   - Travel → practical and layerable — favor separates you can layer/unlayer (jacket + top + bottom), comfortable closed-toe or low-heel footwear, avoid anything hard to move in.
   - Smart Casual → elevated basics, polished but not fussy.
   - Work Meeting → polished, tailored silhouettes, neutral palette, minimal statement accessories.
   - Date Night / Dressy formality → refined fabrics, elevated footwear, a stronger color or print statement.
   - Evening / Special Event / Holiday / Formal → the most elevated pieces available in the catalog, festive color/texture where the catalog has it.
   If occasion and formality seem to conflict, prioritize formality — it's the more direct signal.
5. Respect color harmony (max ~3 dominant colors) and the customer's preferred/avoided colors and stated color mood.
6. Respect the budget tier — prefer items that fit within the stated per-item budget; the overall outfit should feel like it matches that price tier, not just squeak under the ceiling.
7. If an ANCHOR product is provided, include it in every outfit.
8. Only reference product ids that appear in the PRODUCTS list, and never repeat the same product id twice in one outfit.
OUTPUT: Return strict JSON: { "outfits": [{ "name": "string", "productIds": ["id1","id2"], "reason": "string", "occasion": "string" }] }
Return exactly 3 outfits. JSON only, no commentary.`;

      const userPrompt = `Create 3 outfit combinations.
PRODUCTS:
${JSON.stringify(productCatalog, null, 2)}
${anchorProduct ? `\nANCHOR (must include in every outfit): id=${anchorProduct.id} name="${anchorProduct.name}" category=${anchorProduct.category}` : ""}
${occasion ? `\nOCCASION OVERRIDE: ${occasion}` : ""}${style ? `\nSTYLE OVERRIDE: ${style}` : ""}${personalization}

Make the 3 outfits meaningfully different from each other — vary the base garment and at least one other piece between them, don't reuse the same top+jacket pairing twice.
Variation seed: ${crypto.randomUUID()}`;

      const aiMessages = [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }];

      const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: aiMessages, temperature: 1.1 }),
      });

      if (!aiResp.ok) {
        const errBody = await aiResp.text();
        console.error("AI error:", aiResp.status, errBody);
        return json({ error: "AI service temporarily unavailable" }, 500);
      }

      const aiData = await aiResp.json();

      let content = aiData.choices?.[0]?.message?.content?.trim() || "";
      if (content.startsWith("```json")) content = content.slice(7);
      else if (content.startsWith("```")) content = content.slice(3);
      if (content.endsWith("```")) content = content.slice(0, -3);

      let parsed;
      try { parsed = JSON.parse(content.trim()); } catch {
        console.error("Failed to parse AI response:", content);
        return json({ error: "Failed to parse outfit recommendations" }, 500);
      }

      const outfits = (parsed.outfits || []).map((o: any, i: number) => {
        const items = (o.productIds || [])
          .map((id: string) => products.find((p: any) => p.id === id))
          .filter(Boolean)
          .map((p: any) => ({
            id: p.id,
            name: p.name,
            price: Number(p.price),
            image_url: p.image_url,
            category: p.category,
            product_type: p.product_type,
            color: p.color,
            fit: p.fit,
            // Prefer the variant matching the customer's size when available
            shopify_variant_id: p._matchedVariantId || p.shopify_variant_id || null,
            // Items in /generate come from the in_stock filter + size availability check.
            // `available` (preferred) and `in_stock` (back-compat) both reflect whether
            // a buyable variant exists in Shopify for this product right now.
            in_stock: p._sizeAvailable !== false && p.inventory_status === "in_stock",
            available: p._sizeAvailable !== false && p.inventory_status === "in_stock",
          }));
        const outfitId = crypto.randomUUID();
        return {
          id: outfitId,
          name: o.name || `Look ${i + 1}`,
          items,
          totalPrice: items.reduce((s: number, p: any) => s + Number(p.price), 0),
          reason: o.reason,
          occasion: o.occasion,
        };
      }).filter((o: any) => o.items.length > 0);

      // Persist to DB for analytics — fire-and-forget, never blocks outfit delivery
      (async () => {
        try {
          const { error: outfitErr } = await supabase.from("outfits").insert(
            outfits.map((o: any) => ({
              id: o.id,
              brand_id,
              name: o.name,
              anchor_product_id: anchorProduct?.id ?? null,
              total_price: o.totalPrice,
            }))
          );
          if (outfitErr) { console.error("[widget-outfits/generate] outfit persist:", outfitErr.message); return; }
          const itemRows = outfits.flatMap((o: any) =>
            o.items.map((item: any, pos: number) => ({ outfit_id: o.id, product_id: item.id, position: pos }))
          );
          if (itemRows.length) {
            const { error: itemErr } = await supabase.from("outfit_items").insert(itemRows);
            if (itemErr) console.error("[widget-outfits/generate] outfit_items persist:", itemErr.message);
          }
        } catch (e) {
          console.error("[widget-outfits/generate] persist exception:", e);
        }
      })();

      // Validate: dedup exclusive categories/conflicts, backfill from the full
      // catalog if that dedup dropped an outfit below minItems, then discard
      // anything that still doesn't meet the merchant's rules.
      // Progressive fallback guarantees customers always see outfits.
      const deduped = dedupeAndClamp(outfits, maxItems);
      // Force the anchor product into every outfit server-side — the prompt
      // asks the model to do this but it doesn't reliably comply.
      const withAnchor = anchorProduct ? deduped.map(o => ensureAnchor(o, anchorProduct, maxItems)) : deduped;
      const backfilled = withAnchor.map(o => backfillOutfit(o, minItems, maxItems, products));
      console.log("[validate] per-outfit item counts", {
        minItems,
        requiredCats,
        outfits: backfilled.map((o: any, idx: number) => ({
          name: o.name,
          ai_picked: deduped[idx]?.items?.length ?? null,
          after_backfill: o.items.length,
          // raw = the literal category stored in the DB, effective = what
          // effectiveCategory() resolved it to. Comparing the two tells us
          // whether an item's real category field is wrong/unexpected vs. our
          // resolution logic misclassifying something that's actually fine.
          items: o.items.map((i: any) => ({ name: i.name, raw_category: i.category, effective: effectiveCategory(i) })),
        })),
      });
      let finalOutfits = filterByRequirements(backfilled, minItems, requiredCats);
      if (finalOutfits.length === 0 && backfilled.length > 0) {
        console.log("[validate] all outfits failed strict validation — relaxing to dedup+backfill only");
        finalOutfits = backfilled;
      }
      if (finalOutfits.length === 0) {
        console.log("[validate] relaxed validation also empty — returning pre-validation outfits");
        finalOutfits = outfits;
      }
      return json({ outfits: finalOutfits });
    }

    // --- SAVED (requires customer JWT) ---
    if (path === "saved" && req.method === "GET") {
      const customer = await verifyCustomerJwt(req);
      if (!customer) return json({ error: "Unauthorized" }, 401);

      const { data } = await supabase
        .from("saved_outfits")
        .select("*")
        .eq("customer_account_id", customer.sub)
        .eq("brand_id", customer.brand_id)
        .order("created_at", { ascending: false });

      return json({ outfits: data || [] });
    }

    // --- SAVE ---
    if (path === "save" && req.method === "POST") {
      const customer = await verifyCustomerJwt(req);
      if (!customer) return json({ error: "Unauthorized" }, 401);

      const { outfit_data, name } = await req.json();
      if (!outfit_data) return json({ error: "outfit_data is required" }, 400);

      const { data, error } = await supabase
        .from("saved_outfits")
        .insert({
          customer_account_id: customer.sub,
          brand_id: customer.brand_id,
          outfit_data,
          name: name || null,
        })
        .select()
        .single();

      if (error) {
        console.error("Save outfit error:", error);
        return json({ error: "Failed to save outfit" }, 500);
      }

      return json({ outfit: data });
    }

    // --- DELETE ---
    if (path === "delete" && req.method === "POST") {
      const customer = await verifyCustomerJwt(req);
      if (!customer) return json({ error: "Unauthorized" }, 401);

      const { outfit_id } = await req.json();
      if (!outfit_id) return json({ error: "outfit_id is required" }, 400);

      const { error } = await supabase
        .from("saved_outfits")
        .delete()
        .eq("id", outfit_id)
        .eq("customer_account_id", customer.sub);

      if (error) {
        console.error("Delete outfit error:", error);
        return json({ error: "Failed to delete outfit" }, 500);
      }

      return json({ success: true });
    }

    // --- STOCK CHECK (public) ---
    // Body: { brand_id?, shop?, variant_ids: string[] }
    // Returns: { stock: { [variant_id]: boolean } }
    if (path === "stock" && req.method === "POST") {
      const body = await req.json();
      let brand_id: string | undefined = body.brand_id;
      const shop: string | undefined = body.shop;
      const variantIds: string[] = Array.isArray(body.variant_ids)
        ? body.variant_ids.map((v: unknown) => String(v)).filter(Boolean)
        : [];

      if (shop) {
        const shopDomain = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;
        const { data: brandRow } = await supabase
          .from("brands").select("id").eq("shopify_store_domain", shopDomain).maybeSingle();
        if (brandRow?.id) brand_id = brandRow.id;
      }
      if (!brand_id) return json({ error: "brand_id or shop required" }, 400);
      if (!variantIds.length) return json({ stock: {} });

      const { data: prods } = await supabase
        .from("products")
        .select("shopify_variant_id, inventory_status, variants_json")
        .eq("brand_id", brand_id)
        .or(variantIds.flatMap((v) => [`shopify_variant_id.eq.${v}`, `variants_json.cs.[{"variant_id":"${v}"}]`]).join(","));

      const stock: Record<string, boolean> = {};
      for (const id of variantIds) stock[id] = false;
      for (const p of prods || []) {
        const variants: any[] = Array.isArray(p.variants_json) ? p.variants_json : [];
        const inStockBase = (p.inventory_status || "in_stock") === "in_stock";
        for (const id of variantIds) {
          if (String(p.shopify_variant_id) === id) {
            stock[id] = inStockBase && (variants.length === 0 || variants.some((v) => v?.available !== false));
          }
          for (const v of variants) {
            if (v?.variant_id && String(v.variant_id) === id) {
              stock[id] = inStockBase && v?.available !== false;
            }
          }
        }
      }
      return json({ stock });
    }

    // --- EVENT (public: view or conversion) ---
    if (path === "event" && req.method === "POST") {
      const body = await req.json();
      let brand_id: string | undefined = body.brand_id;
      const shop: string | undefined = body.shop;
      const outfit_id: string | undefined = body.outfit_id;
      const event_type: string | undefined = body.event_type;

      if (!event_type || !["view", "conversion"].includes(event_type)) {
        return json({ error: "event_type must be 'view' or 'conversion'" }, 400);
      }
      if (shop) {
        const shopDomain = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;
        const { data: brandRow } = await supabase
          .from("brands").select("id").eq("shopify_store_domain", shopDomain).maybeSingle();
        if (brandRow?.id) brand_id = brandRow.id;
      }
      if (!brand_id) return json({ error: "brand_id or shop required" }, 400);

      const { error: evtErr } = await supabase
        .from("widget_events")
        .insert({ brand_id, outfit_id: outfit_id || null, event_type });
      if (evtErr) {
        console.error("[widget-outfits/event] insert:", evtErr.message);
        return json({ error: "Failed to record event" }, 500);
      }
      if (outfit_id) {
        const rpcName = event_type === "view" ? "increment_outfit_views" : "increment_outfit_conversions";
        await supabase.rpc(rpcName, { p_outfit_id: outfit_id });
      }
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  } catch (error) {
    console.error("widget-outfits error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
