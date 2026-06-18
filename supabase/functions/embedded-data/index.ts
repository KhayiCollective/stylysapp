// Edge function: returns brand / products / rules for the embedded Shopify admin
// app, scoped to a single verified shop. Uses the service role so it does NOT
// rely on Supabase Auth in the iframe, and never returns secrets
// (shopify_access_token, shopify_storefront_token, stripe_*).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SHOPIFY_CLIENT_SECRET = Deno.env.get("SHOPIFY_CLIENT_SECRET") ?? "";

// ---------- session verification helpers ----------

function normalizeShop(shop: string): string | null {
  const s = shop.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s)) return null;
  return s;
}

// Decode the `host` param (base64) and confirm it references the same shop.
// Shopify host values look like:
//   "<shop>.myshopify.com/admin"
//   "admin.shopify.com/store/<handle>"
function hostMatchesShop(host: string, shop: string): boolean {
  try {
    const padded = host + "=".repeat((4 - (host.length % 4)) % 4);
    const decoded = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    const shopHandle = shop.replace(".myshopify.com", "");
    return (
      decoded.includes(shop) ||
      decoded.includes(`/store/${shopHandle}`)
    );
  } catch {
    return false;
  }
}

// Optional HMAC verification (only if hmac is supplied AND secret is set).
async function verifyHmac(params: URLSearchParams, hmac: string): Promise<boolean> {
  if (!SHOPIFY_CLIENT_SECRET) return false;
  const entries: [string, string][] = [];
  for (const [k, v] of params) if (k !== "hmac" && k !== "signature") entries.push([k, v]);
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const message = entries.map(([k, v]) => `${k}=${v}`).join("&");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SHOPIFY_CLIENT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // timing-safe compare
  if (hex.length !== hmac.length) return false;
  let r = 0;
  for (let i = 0; i < hex.length; i++) r |= hex.charCodeAt(i) ^ hmac.charCodeAt(i);
  return r === 0;
}

// ---------- main handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);

    const shopRaw: string =
      body.shop ?? url.searchParams.get("shop") ?? "";
    const host: string =
      body.host ?? url.searchParams.get("host") ?? "";
    const hmac: string =
      body.hmac ?? url.searchParams.get("hmac") ?? "";
    const resource: string =
      body.resource ?? url.searchParams.get("resource") ?? "brand";

    const shop = normalizeShop(shopRaw);
    if (!shop) {
      return json({ error: "Invalid shop" }, 400);
    }

    // Session verification: require either a valid host OR a valid hmac.
    let verified = false;
    if (host && hostMatchesShop(host, shop)) verified = true;
    if (!verified && hmac) {
      const params = new URLSearchParams();
      // Reconstruct signed params from body (excluding hmac itself)
      for (const [k, v] of Object.entries(body)) {
        if (k === "hmac" || k === "resource") continue;
        if (typeof v === "string") params.append(k, v);
      }
      verified = await verifyHmac(params, hmac);
    }
    if (!verified) {
      return json({ error: "Unverified Shopify session" }, 401);
    }

    // Service-role client — bypasses RLS, scoped server-side by `shop`.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Resolve brand for this shop. Match exact domain or handle variants.
    const handle = shop.replace(".myshopify.com", "");
    const { data: brandRow, error: brandErr } = await admin
      .from("brands")
      .select(
        "id, name, slug, shopify_store_domain, shopify_connected_at, created_at, updated_at",
      )
      .or(
        `shopify_store_domain.eq.${shop},shopify_store_domain.eq.${handle},shopify_store_domain.ilike.%${handle}%`,
      )
      .maybeSingle();

    if (brandErr) {
      console.error("[embedded-data] brand lookup error:", brandErr.message);
      return json({ error: "Brand lookup failed" }, 500);
    }
    if (!brandRow) {
      return json({ brand: null, products: [], rules: [], productCount: 0 });
    }

    // Defensive: never let secret-bearing fields leak even if the select widens.
    const brand = {
      id: brandRow.id,
      name: brandRow.name,
      slug: brandRow.slug,
      shopify_store_domain: brandRow.shopify_store_domain,
      shopify_connected_at: brandRow.shopify_connected_at,
    };

    if (resource === "brand") {
      return json({ brand });
    }

    if (resource === "products") {
      const { data, error } = await admin
        .from("products")
        .select("id, name, image_url, category, color, fit, price, inventory_status, tags")
        .eq("brand_id", brand.id)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json({ brand, products: data ?? [] });
    }

    if (resource === "rules") {
      const { data, error } = await admin
        .from("rules")
        .select("id, name, description, enabled, category")
        .eq("brand_id", brand.id)
        .order("category");
      if (error) return json({ error: error.message }, 500);
      return json({ brand, rules: data ?? [] });
    }

    if (resource === "settings") {
      const { count, error } = await admin
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", brand.id);
      if (error) return json({ error: error.message }, 500);
      return json({ brand, productCount: count ?? 0 });
    }

    return json({ error: "Unknown resource" }, 400);
  } catch (err) {
    console.error("[embedded-data] unexpected error:", err);
    return json({ error: "Internal error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
