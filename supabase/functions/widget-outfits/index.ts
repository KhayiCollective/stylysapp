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

async function verifyCustomerJwt(req: Request): Promise<{ sub: string; brand_id: string; email: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const key = await getJwtKey();
    const payload = await verify(authHeader.replace("Bearer ", ""), key);
    return { sub: payload.sub as string, brand_id: payload.brand_id as string, email: payload.email as string };
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

    // --- GENERATE (public, just needs brand_id) ---
    if (path === "generate" && req.method === "POST") {
      const { brand_id, anchor_product_id, occasion, style } = await req.json();
      if (!brand_id) return json({ error: "brand_id is required" }, 400);

      // Fetch products for this brand
      const { data: products, error: prodErr } = await supabase
        .from("products")
        .select("id, name, price, image_url, category, color, fit, shopify_variant_id, shopify_product_id")
        .eq("brand_id", brand_id)
        .eq("inventory_status", "in_stock")
        .limit(30);

      if (prodErr || !products?.length) {
        return json({ error: "No products available" }, 404);
      }

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) return json({ error: "AI service not configured" }, 500);

      // Match anchor by UUID first, then by Shopify GID
      let anchorProduct: any = null;
      if (anchor_product_id) {
        anchorProduct = products.find(p => p.id === anchor_product_id);
        if (!anchorProduct && anchor_product_id.includes("gid://")) {
          const numericId = anchor_product_id.split("/").pop();
          if (numericId) {
            anchorProduct = products.find(p => p.shopify_product_id === numericId);
          }
        }
      }
      const productCatalog = products.map(p => ({
        id: p.id, name: p.name, category: p.category, color: p.color || "unknown"
      }));

      const systemPrompt = `You are STYLYS, an expert AI fashion stylist. Create cohesive outfit combinations from a product catalog.
RULES:
1. Each outfit must have 2-5 items that work together aesthetically
2. Consider color harmony
3. Balance categories - top, bottom, optional accessories/layers
4. If an anchor product is specified, include it in all outfits
OUTPUT: Return JSON: { "outfits": [{ "name": "string", "productIds": ["id1","id2"], "reason": "string", "occasion": "string" }] }
Return exactly 3 outfits. Only valid JSON, no other text.`;

      const userPrompt = `Create 3 outfit combinations:\nPRODUCTS:\n${JSON.stringify(productCatalog, null, 2)}
${anchorProduct ? `\nANCHOR (must include): ${anchorProduct.name} (${anchorProduct.category})` : ""}
${occasion ? `\nOCCASION: ${occasion}` : ""}${style ? `\nSTYLE: ${style}` : ""}
\nVariation seed: ${crypto.randomUUID()}`;

      const aiMessages = [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }];
      const models = ["google/gemini-2.5-flash", "openai/gpt-5-nano", "google/gemini-2.5-flash-lite"];
      let aiData: any = null;

      for (const model of models) {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages: aiMessages, temperature: 1.2 }),
        });

        if (aiResp.ok) {
          aiData = await aiResp.json();
          break;
        }

        const errBody = await aiResp.text();
        console.error(`AI error (${model}):`, aiResp.status, errBody);
        // Try next model
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

      const outfits = parsed.outfits.map((o: any, i: number) => {
        const items = o.productIds.map((id: string) => products.find(p => p.id === id)).filter(Boolean)
          .map((p: any) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            image_url: p.image_url,
            category: p.category,
            color: p.color,
            fit: p.fit,
            shopify_variant_id: p.shopify_variant_id || null,
          }));
        return {
          id: crypto.randomUUID(),
          name: o.name || `Look ${i + 1}`,
          items,
          totalPrice: items.reduce((s: number, p: any) => s + Number(p.price), 0),
          reason: o.reason,
          occasion: o.occasion,
        };
      });

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

    return json({ error: "Not found" }, 404);
  } catch (error) {
    console.error("widget-outfits error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
