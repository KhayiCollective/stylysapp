import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (d: unknown, s = 200) =>
    new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = admin();
    const body = await req.json();
    let { brand_id, shop, product_id, shopify_variant_id, product_name, email } = body || {};

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return json({ error: "Valid email is required" }, 400);
    }
    email = email.trim().toLowerCase();

    if (shop) {
      const shopDomain = String(shop).includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;
      const { data: brandRow } = await supabase
        .from("brands").select("id").eq("shopify_store_domain", shopDomain).maybeSingle();
      if (brandRow?.id) brand_id = brandRow.id;
    }

    if (!brand_id) return json({ error: "brand_id or shop required" }, 400);
    if (!shopify_variant_id && !product_id) {
      return json({ error: "product_id or shopify_variant_id required" }, 400);
    }

    const variantStr = shopify_variant_id ? String(shopify_variant_id) : null;

    // Upsert-style: avoid duplicates per (brand, variant, email).
    if (variantStr) {
      const { data: existing } = await supabase
        .from("restock_notifications")
        .select("id")
        .eq("brand_id", brand_id)
        .eq("shopify_variant_id", variantStr)
        .eq("email", email)
        .maybeSingle();
      if (existing?.id) return json({ ok: true, already: true });
    }

    const { error } = await supabase.from("restock_notifications").insert({
      brand_id,
      product_id: product_id || null,
      shopify_variant_id: variantStr,
      product_name: product_name || null,
      email,
    });
    if (error) {
      console.error("[widget-notify] insert error", error);
      return json({ error: "Failed to save notification" }, 500);
    }
    return json({ ok: true });
  } catch (e) {
    console.error("[widget-notify] error", e);
    return json({ error: "Server error" }, 500);
  }
});
