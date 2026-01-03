import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiting (per-instance, resets on cold start)
// For production, consider distributed rate limiting with Redis/Upstash
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute per IP+brand

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count };
}

// Clean up old rate limit entries periodically (prevent memory leak)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000);

// Input validation helpers
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

function sanitizeString(str: string, maxLength: number = 100): string {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
}

function sanitizeStringArray(arr: unknown, maxItems: number = 10, maxLength: number = 50): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .slice(0, maxItems)
    .filter((item): item is string => typeof item === 'string')
    .map(item => sanitizeString(item, maxLength));
}

function sanitizeRecord(obj: unknown, maxKeys: number = 20): Record<string, unknown> {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return {};
  const entries = Object.entries(obj).slice(0, maxKeys);
  const result: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    const sanitizedKey = sanitizeString(key, 50);
    if (sanitizedKey) {
      // Only allow primitive values or simple nested objects
      if (typeof value === 'string') {
        result[sanitizedKey] = sanitizeString(value, 200);
      } else if (typeof value === 'number' && isFinite(value)) {
        result[sanitizedKey] = value;
      } else if (typeof value === 'boolean') {
        result[sanitizedKey] = value;
      }
    }
  }
  return result;
}

function sanitizeBudgetRange(budget: unknown): { min?: number; max?: number } {
  if (typeof budget !== 'object' || budget === null) return {};
  const result: { min?: number; max?: number } = {};
  const b = budget as Record<string, unknown>;
  if (typeof b.min === 'number' && isFinite(b.min) && b.min >= 0 && b.min <= 100000) {
    result.min = b.min;
  }
  if (typeof b.max === 'number' && isFinite(b.max) && b.max >= 0 && b.max <= 100000) {
    result.max = b.max;
  }
  return result;
}

const VALID_BODY_SHAPES = ['hourglass', 'pear', 'apple', 'rectangle', 'triangle', 'inverted_triangle', 'oval'];

function sanitizeBodyShape(shape: unknown): string | null {
  if (typeof shape !== 'string') return null;
  const normalized = shape.toLowerCase().trim();
  return VALID_BODY_SHAPES.includes(normalized) ? normalized : null;
}

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

interface ValidatedQuizData {
  email?: string;
  stylePreferences: Record<string, unknown>;
  preferredColors: string[];
  avoidedColors: string[];
  bodyShape: string | null;
  occasions: string[];
  budgetRange: { min?: number; max?: number };
  sizeInfo: Record<string, unknown>;
}

function validateAndSanitizeQuizData(data: unknown): { valid: boolean; data?: ValidatedQuizData; error?: string } {
  if (typeof data !== 'object' || data === null) {
    return { valid: false, error: 'Invalid quiz data format' };
  }

  const raw = data as QuizData;
  
  // Validate email if provided
  let email: string | undefined;
  if (raw.email !== undefined) {
    if (typeof raw.email !== 'string' || !isValidEmail(raw.email)) {
      return { valid: false, error: 'Invalid email format' };
    }
    email = raw.email.trim().toLowerCase();
  }

  return {
    valid: true,
    data: {
      email,
      stylePreferences: sanitizeRecord(raw.stylePreferences),
      preferredColors: sanitizeStringArray(raw.preferredColors),
      avoidedColors: sanitizeStringArray(raw.avoidedColors),
      bodyShape: sanitizeBodyShape(raw.bodyShape),
      occasions: sanitizeStringArray(raw.occasions),
      budgetRange: sanitizeBudgetRange(raw.budgetRange),
      sizeInfo: sanitizeRecord(raw.sizeInfo),
    }
  };
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

    // Validate brand_id format
    if (!brandId) {
      return new Response(
        JSON.stringify({ error: "brand_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isValidUUID(brandId)) {
      return new Response(
        JSON.stringify({ error: "Invalid brand_id format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting based on IP + brand combination
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("cf-connecting-ip") || 
                     "unknown";
    const rateLimitKey = `${clientIP}:${brandId}`;
    const rateLimit = checkRateLimit(rateLimitKey);

    if (!rateLimit.allowed) {
      console.warn(`Rate limit exceeded for ${rateLimitKey}`);
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Retry-After": "60"
          } 
        }
      );
    }

    // GET: Fetch widget config and products for a brand
    if (req.method === "GET") {
      const [configResult, productsResult, rulesResult] = await Promise.all([
        supabase.from("widget_config").select("*").eq("brand_id", brandId).single(),
        supabase.from("products").select("id, name, price, image_url, category, color, fit, inventory_status").eq("brand_id", brandId).eq("inventory_status", "in_stock").limit(500),
        supabase.from("rules").select("name, category, config").eq("brand_id", brandId).eq("enabled", true),
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
      // Check content length to prevent oversized payloads
      const contentLength = req.headers.get("content-length");
      if (contentLength && parseInt(contentLength) > 50000) { // 50KB limit
        return new Response(
          JSON.stringify({ error: "Request body too large" }),
          { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid JSON body" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (typeof body !== 'object' || body === null) {
        return new Response(
          JSON.stringify({ error: "Invalid request body" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const requestBody = body as { quizData?: unknown; anchorProductId?: unknown };
      
      // Validate anchorProductId if provided
      let anchorProductId: string | undefined;
      if (requestBody.anchorProductId !== undefined) {
        if (typeof requestBody.anchorProductId !== 'string' || !isValidUUID(requestBody.anchorProductId)) {
          return new Response(
            JSON.stringify({ error: "Invalid anchorProductId format" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        anchorProductId = requestBody.anchorProductId;
      }

      // Validate and sanitize quiz data
      let validatedQuizData: ValidatedQuizData | undefined;
      if (requestBody.quizData !== undefined) {
        const validation = validateAndSanitizeQuizData(requestBody.quizData);
        if (!validation.valid) {
          return new Response(
            JSON.stringify({ error: validation.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        validatedQuizData = validation.data;
      }

      // Fetch brand's products and rules
      const [productsResult, rulesResult] = await Promise.all([
        supabase.from("products").select("id, name, price, image_url, category, color, fit, inventory_status").eq("brand_id", brandId).eq("inventory_status", "in_stock").limit(500),
        supabase.from("rules").select("name, category, config").eq("brand_id", brandId).eq("enabled", true),
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
      if (validatedQuizData?.email) {
        const { data: existingCustomer } = await supabase
          .from("customers")
          .select("id")
          .eq("brand_id", brandId)
          .eq("email", validatedQuizData.email)
          .single();

        if (existingCustomer) {
          customerId = existingCustomer.id;
          await supabase
            .from("customers")
            .update({
              style_preferences: validatedQuizData.stylePreferences,
              preferred_colors: validatedQuizData.preferredColors,
              avoided_colors: validatedQuizData.avoidedColors,
              body_shape: validatedQuizData.bodyShape,
              occasions: validatedQuizData.occasions,
              budget_range: validatedQuizData.budgetRange,
              size_info: validatedQuizData.sizeInfo,
              quiz_completed_at: new Date().toISOString(),
            })
            .eq("id", customerId);
        } else {
          const { data: newCustomer } = await supabase
            .from("customers")
            .insert({
              brand_id: brandId,
              email: validatedQuizData.email,
              style_preferences: validatedQuizData.stylePreferences,
              preferred_colors: validatedQuizData.preferredColors,
              avoided_colors: validatedQuizData.avoidedColors,
              body_shape: validatedQuizData.bodyShape,
              occasions: validatedQuizData.occasions,
              budget_range: validatedQuizData.budgetRange,
              size_info: validatedQuizData.sizeInfo,
              quiz_completed_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          customerId = newCustomer?.id || null;
        }
      }

      // Generate outfits using rule-based logic
      const outfits = generateOutfits(products, rules, validatedQuizData, anchorProductId);

      // Store recommendations if we have a customer
      if (customerId && outfits.length > 0) {
        const recommendations = outfits.map((outfit) => ({
          brand_id: brandId,
          customer_id: customerId,
          outfit_id: outfit.id,
          occasion: validatedQuizData?.occasions?.[0] || null,
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
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Rule-based outfit generation
function generateOutfits(
  products: Product[],
  rules: { name: string; category: string; config: Record<string, unknown> }[],
  quizData?: ValidatedQuizData,
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
