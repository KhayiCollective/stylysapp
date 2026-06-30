import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  const { shop } = await req.json();
  if (!shop) {
    return new Response(JSON.stringify({ error: "shop required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Look up access token for this shop
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const shopName = shop.replace(".myshopify.com", "");
  const { data: brand, error } = await supabase
    .from("brands")
    .select("id, shopify_access_token")
    .or(`shopify_store_domain.eq.${shop},shopify_store_domain.ilike.%${shopName}%`)
    .not("shopify_access_token", "is", null)
    .maybeSingle();

  if (error || !brand) {
    return new Response(JSON.stringify({ error: "Brand or access token not found", detail: error?.message }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // List all script tags on the store
  const listResp = await fetch(`https://${shop}/admin/api/2025-01/script_tags.json`, {
    headers: { "X-Shopify-Access-Token": brand.shopify_access_token },
  });

  if (!listResp.ok) {
    return new Response(JSON.stringify({ error: "Failed to list script tags", status: listResp.status }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { script_tags } = await listResp.json();
  const OLD_PROJECT = "mggxvtfgakplzzpcclte";
  const toDelete = script_tags.filter((t: { src: string }) => t.src.includes(OLD_PROJECT));

  if (toDelete.length === 0) {
    return new Response(JSON.stringify({ message: "No stale script tags found", all_tags: script_tags.map((t: { id: number; src: string }) => ({ id: t.id, src: t.src })) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results = [];
  for (const tag of toDelete) {
    const delResp = await fetch(`https://${shop}/admin/api/2025-01/script_tags/${tag.id}.json`, {
      method: "DELETE",
      headers: { "X-Shopify-Access-Token": brand.shopify_access_token },
    });
    results.push({ id: tag.id, src: tag.src, deleted: delResp.status === 200 || delResp.status === 204 });
  }

  return new Response(JSON.stringify({ deleted: results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
