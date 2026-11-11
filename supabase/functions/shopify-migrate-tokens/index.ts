// One-time migration of legacy non-expiring Shopify offline tokens to expiring
// tokens. Admin-only: requires the service role key as a Bearer token.
//
//   dry run:  POST {"dry_run": true}
//   real run: POST {}   (optionally {"shop": "store.myshopify.com"} for one store)
//
// Never logs or returns token values.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { migrateLegacyToken } from "../_shared/shopify-token.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!serviceKey || bearer !== serviceKey) return json({ error: "Unauthorized" }, 401);

  let body: { dry_run?: boolean; shop?: string } = {};
  try { body = await req.json(); } catch { /* empty body ok */ }

  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey, {
    auth: { persistSession: false },
  });

  let q = supabase
    .from("brands")
    .select("id, name, shopify_store_domain, shopify_access_token, shopify_token_expires_at")
    .not("shopify_access_token", "is", null)
    .is("shopify_token_expires_at", null);
  if (body.shop) q = q.eq("shopify_store_domain", body.shop);

  const { data: brands, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const results: Array<Record<string, unknown>> = [];
  for (const b of brands ?? []) {
    const base = { brand: b.name, shop: b.shopify_store_domain };
    if (!b.shopify_store_domain) { results.push({ ...base, status: "skipped: no domain" }); continue; }
    if (body.dry_run) { results.push({ ...base, status: "would migrate" }); continue; }
    try {
      const r = await migrateLegacyToken(supabase, b.id, b.shopify_store_domain, b.shopify_access_token);
      results.push({ ...base, status: "migrated", expires_in: r.expires_in });
    } catch (e) {
      results.push({ ...base, status: "failed", error: e instanceof Error ? e.message : String(e) });
    }
  }

  return json({ dry_run: !!body.dry_run, count: results.length, results });
});
