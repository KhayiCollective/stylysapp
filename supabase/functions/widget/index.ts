import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuizData {
  email?: string;
  stylePreferences?: Record<string, unknown>;
  preferredColors?: string[];
  avoidedColors?: string[];
  bodyShape?: string;
  occasions?: string[];
  budgetRange?: { min?: number; max?: number };
  sizeInfo?: Record<string, unknown>;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category: string;
  color: string | null;
  fit: string | null;
  inventory_status: string;
}

interface Outfit {
  id: string;
  name: string | null;
  products: Product[];
  totalPrice: number;
  reason?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const brandId = url.searchParams.get("brand_id");

    if (!brandId) {
      return new Response(
        JSON.stringify({ error: "brand_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET: Fetch widget config and products for a brand
    if (req.method === "GET") {
      const [configResult, productsResult, rulesResult] = await Promise.all([
        supabase.from("widget_config").select("*").eq("brand_id", brandId).single(),
        supabase.from("products").select("*").eq("brand_id", brandId).eq("inventory_status", "in_stock"),
        supabase.from("rules").select("*").eq("brand_id", brandId).eq("enabled", true),
      ]);

      if (configResult.error) {
        console.error("Error fetching widget config:", configResult.error);
        return new Response(
          JSON.stringify({ error: "Brand not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          config: configResult.data,
          products: productsResult.data || [],
          rules: rulesResult.data || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST: Submit quiz and get recommendations
    if (req.method === "POST") {
      const body = await req.json();
      const { quizData, anchorProductId } = body as { quizData?: QuizData; anchorProductId?: string };

      // Fetch brand's products and rules
      const [productsResult, rulesResult] = await Promise.all([
        supabase.from("products").select("*").eq("brand_id", brandId).eq("inventory_status", "in_stock"),
        supabase.from("rules").select("*").eq("brand_id", brandId).eq("enabled", true),
      ]);

      if (productsResult.error) {
        console.error("Error fetching products:", productsResult.error);
        return new Response(
          JSON.stringify({ error: "Failed to fetch products" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const products: Product[] = productsResult.data || [];
      const rules = rulesResult.data || [];

      // Create or update customer if email provided
      let customerId: string | null = null;
      if (quizData?.email) {
        const { data: existingCustomer } = await supabase
          .from("customers")
          .select("id")
          .eq("brand_id", brandId)
          .eq("email", quizData.email)
          .single();

        if (existingCustomer) {
          customerId = existingCustomer.id;
          await supabase
            .from("customers")
            .update({
              style_preferences: quizData.stylePreferences || {},
              preferred_colors: quizData.preferredColors || [],
              avoided_colors: quizData.avoidedColors || [],
              body_shape: quizData.bodyShape,
              occasions: quizData.occasions || [],
              budget_range: quizData.budgetRange || {},
              size_info: quizData.sizeInfo || {},
              quiz_completed_at: new Date().toISOString(),
            })
            .eq("id", customerId);
        } else {
          const { data: newCustomer } = await supabase
            .from("customers")
            .insert({
              brand_id: brandId,
              email: quizData.email,
              style_preferences: quizData.stylePreferences || {},
              preferred_colors: quizData.preferredColors || [],
              avoided_colors: quizData.avoidedColors || [],
              body_shape: quizData.bodyShape,
              occasions: quizData.occasions || [],
              budget_range: quizData.budgetRange || {},
              size_info: quizData.sizeInfo || {},
              quiz_completed_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          customerId = newCustomer?.id || null;
        }
      }

      // Generate outfits using rule-based logic
      const outfits = generateOutfits(products, rules, quizData, anchorProductId);

      // Store recommendations if we have a customer
      if (customerId && outfits.length > 0) {
        const recommendations = outfits.map((outfit) => ({
          brand_id: brandId,
          customer_id: customerId,
          outfit_id: outfit.id,
          occasion: quizData?.occasions?.[0] || null,
          reason: outfit.reason || null,
        }));

        await supabase.from("recommendations").insert(recommendations);
      }

      return new Response(
        JSON.stringify({ outfits, customerId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Widget error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Rule-based outfit generation
function generateOutfits(
  products: Product[],
  rules: { name: string; category: string; config: Record<string, unknown> }[],
  quizData?: QuizData,
  anchorProductId?: string
): Outfit[] {
  if (products.length === 0) return [];

  const ruleMap = new Map(rules.map((r) => [r.name, r]));
  const outfits: Outfit[] = [];

  // Categorize products
  const tops = products.filter((p) => ["top", "shirt", "blouse", "sweater", "jacket"].includes(p.category.toLowerCase()));
  const bottoms = products.filter((p) => ["bottom", "pants", "skirt", "jeans", "shorts"].includes(p.category.toLowerCase()));
  const dresses = products.filter((p) => ["dress"].includes(p.category.toLowerCase()));
  const layers = products.filter((p) => ["layer", "jacket", "coat", "cardigan", "blazer"].includes(p.category.toLowerCase()));
  const accessories = products.filter((p) => ["accessory", "bag", "shoes", "jewelry", "hat", "scarf"].includes(p.category.toLowerCase()));

  // Find anchor product if specified
  let anchor: Product | undefined;
  if (anchorProductId) {
    anchor = products.find((p) => p.id === anchorProductId);
  }

  // Filter by customer preferences
  let filteredProducts = [...products];
  if (quizData?.preferredColors?.length) {
    const preferred = quizData.preferredColors.map((c) => c.toLowerCase());
    filteredProducts = filteredProducts.filter(
      (p) => !p.color || preferred.some((c) => p.color?.toLowerCase().includes(c))
    );
  }
  if (quizData?.avoidedColors?.length) {
    const avoided = quizData.avoidedColors.map((c) => c.toLowerCase());
    filteredProducts = filteredProducts.filter(
      (p) => !p.color || !avoided.some((c) => p.color?.toLowerCase().includes(c))
    );
  }

  // Budget filter
  if (quizData?.budgetRange?.max) {
    filteredProducts = filteredProducts.filter((p) => p.price <= (quizData.budgetRange?.max || Infinity));
  }

  // Generate up to 3 outfit combinations
  const maxOutfits = 3;
  const usedCombinations = new Set<string>();

  for (let i = 0; i < maxOutfits * 3 && outfits.length < maxOutfits; i++) {
    const outfitProducts: Product[] = [];
    let reason = "";

    // Start with anchor if provided
    if (anchor) {
      outfitProducts.push(anchor);
      reason = `Built around ${anchor.name}`;
    }

    // Category Balance rule: top + bottom or dress
    if (ruleMap.has("Category Balance")) {
      if (!anchor || !["dress"].includes(anchor.category.toLowerCase())) {
        // Add top if not anchor
        if (!outfitProducts.some((p) => tops.includes(p))) {
          const availableTops = tops.filter((t) => !outfitProducts.includes(t));
          if (availableTops.length > 0) {
            const top = availableTops[Math.floor(Math.random() * availableTops.length)];
            outfitProducts.push(top);
          }
        }
        // Add bottom
        if (!outfitProducts.some((p) => bottoms.includes(p))) {
          const availableBottoms = bottoms.filter((b) => !outfitProducts.includes(b));
          if (availableBottoms.length > 0) {
            const bottom = availableBottoms[Math.floor(Math.random() * availableBottoms.length)];
            outfitProducts.push(bottom);
          }
        }
      } else if (dresses.length > 0 && !anchor) {
        // Use dress as base
        const dress = dresses[Math.floor(Math.random() * dresses.length)];
        outfitProducts.push(dress);
      }

      // Optional layer
      if (layers.length > 0 && Math.random() > 0.5) {
        const layer = layers[Math.floor(Math.random() * layers.length)];
        if (!outfitProducts.includes(layer)) {
          outfitProducts.push(layer);
        }
      }
    }

    // Color Harmony rule: max 3 dominant colors
    if (ruleMap.has("Color Harmony") && outfitProducts.length > 0) {
      const colors = outfitProducts.map((p) => p.color?.toLowerCase()).filter(Boolean);
      const uniqueColors = [...new Set(colors)];
      if (uniqueColors.length > 3) {
        // Remove products to reduce color count
        while (outfitProducts.length > 2 && new Set(outfitProducts.map((p) => p.color?.toLowerCase())).size > 3) {
          outfitProducts.pop();
        }
      }
      if (uniqueColors.length <= 3 && uniqueColors.length > 0) {
        reason += reason ? ". " : "";
        reason += "Color-coordinated look";
      }
    }

    // Add accessory if available
    if (accessories.length > 0 && outfitProducts.length >= 2) {
      const accessory = accessories[Math.floor(Math.random() * accessories.length)];
      if (!outfitProducts.includes(accessory)) {
        outfitProducts.push(accessory);
      }
    }

    // Check for unique combination
    const comboKey = outfitProducts
      .map((p) => p.id)
      .sort()
      .join("-");
    if (usedCombinations.has(comboKey) || outfitProducts.length < 2) {
      continue;
    }
    usedCombinations.add(comboKey);

    const totalPrice = outfitProducts.reduce((sum, p) => sum + Number(p.price), 0);

    // Price Range Match rule
    if (ruleMap.has("Price Range Match") && quizData?.budgetRange?.max) {
      if (totalPrice > quizData.budgetRange.max) {
        continue; // Skip this outfit
      }
      reason += reason ? ". " : "";
      reason += "Within your budget";
    }

    outfits.push({
      id: crypto.randomUUID(),
      name: `Look ${outfits.length + 1}`,
      products: outfitProducts,
      totalPrice,
      reason: reason || "Curated for you",
    });
  }

  return outfits;
}
