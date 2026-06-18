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

      // Read the merchant's "In-Stock Only" inventory rule. If enabled (default),
      // sold-out products are excluded from outfit generation entirely. If disabled,
      // sold-out products are included and surfaced to the widget with available=false.
      const { data: inStockRule } = await supabase
        .from("rules")
        .select("enabled")
        .eq("brand_id", brand_id)
        .eq("category", "inventory")
        .eq("name", "In-Stock Only")
        .maybeSingle();
      const inStockOnly = inStockRule?.enabled !== false; // default ON if rule missing

      // Fetch products for this brand (richer columns for smarter matching)
      let productsQuery = supabase
        .from("products")
        .select("id, name, price, image_url, category, color, fit, shopify_variant_id, shopify_product_id, product_type, tags, collections, variants_json, images_json, inventory_status")
        .eq("brand_id", brand_id)
        .limit(200);
      if (inStockOnly) {
        productsQuery = productsQuery.eq("inventory_status", "in_stock");
      }
      const { data: rawProducts, error: prodErr } = await productsQuery;

      console.log("[widget-outfits/generate] request", {
        brand_id, anchor_product_id,
        raw_count: rawProducts?.length || 0,
        prod_err: prodErr?.message || null,
      });

      if (prodErr || !rawProducts?.length) {
        return json({ error: "No products available" }, 404);
      }

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) return json({ error: "AI service not configured" }, 500);

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

      const products = filtered.slice(0, 60);
      if (!products.length) {
        console.log("[widget-outfits/generate] no products available", { brand_id, raw: rawProducts.length });
        return json({ error: "No products available" }, 404);
      }

      // ---- Catalog payload for the AI (with product_type, tags, collections) ----
      const productCatalog = products.map((p: any) => ({
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
2. Required categories per outfit: ${requiredCats.join(", ")}. Add optional categories when available: ${optionalCats.join(", ")}.
3. Use product_type, tags, and collections to classify pieces and match them to the customer's occasion, formality, and color mood.
4. Respect color harmony (max ~3 dominant colors) and the customer's preferred/avoided colors.
5. Respect the budget — prefer items that fit within the stated budget.
6. If an ANCHOR product is provided, include it in every outfit.
7. Only reference product ids that appear in the PRODUCTS list. Never invent items.
OUTPUT: Return strict JSON: { "outfits": [{ "name": "string", "productIds": ["id1","id2"], "reason": "string", "occasion": "string" }] }
Return exactly 3 outfits. JSON only, no commentary.`;

      const userPrompt = `Create 3 outfit combinations.
PRODUCTS:
${JSON.stringify(productCatalog, null, 2)}
${anchorProduct ? `\nANCHOR (must include in every outfit): id=${anchorProduct.id} name="${anchorProduct.name}" category=${anchorProduct.category}` : ""}
${occasion ? `\nOCCASION OVERRIDE: ${occasion}` : ""}${style ? `\nSTYLE OVERRIDE: ${style}` : ""}${personalization}

Variation seed: ${crypto.randomUUID()}`;

      const aiMessages = [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }];
      const models = ["google/gemini-2.5-flash", "openai/gpt-5-nano", "google/gemini-2.5-flash-lite"];
      let aiData: any = null;

      for (const model of models) {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages: aiMessages, temperature: 1.1 }),
        });

        if (aiResp.ok) {
          aiData = await aiResp.json();
          break;
        }

        const errBody = await aiResp.text();
        console.error(`AI error (${model}):`, aiResp.status, errBody);
      }

      if (!aiData) {
        return json({ error: "AI service temporarily unavailable" }, 500);
      }
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
        return {
          id: crypto.randomUUID(),
          name: o.name || `Look ${i + 1}`,
          items,
          totalPrice: items.reduce((s: number, p: any) => s + Number(p.price), 0),
          reason: o.reason,
          occasion: o.occasion,
        };
      }).filter((o: any) => o.items.length > 0);

      return json({ outfits });
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
        .or(variantIds.map((v) => `shopify_variant_id.eq.${v}`).join(","));

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

    return json({ error: "Not found" }, 404);
  } catch (error) {
    console.error("widget-outfits error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
