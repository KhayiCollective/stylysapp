import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface ShopifyVariant {
  id: number;
  price: string;
  title: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  inventory_quantity?: number;
  inventory_item_id?: number;
}

interface ShopifyImage {
  id?: number;
  src: string;
  alt?: string | null;
  position?: number;
  width?: number;
  height?: number;
  variant_ids?: number[];
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  product_type: string;
  tags?: string;
  vendor?: string;
  status?: string;
  images: ShopifyImage[];
  variants: ShopifyVariant[];
  options: { name: string; position: number; values: string[] }[];
}

interface ShopifyWebhook {
  id: number;
  topic: string;
  address: string;
  created_at: string;
}

const COLOR_OPTION_NAMES = ["color", "colour", "colors", "colours"];
const SIZE_OPTION_NAMES = ["size", "sizes", "length", "width"];

function identifyOptionAxes(options: ShopifyProduct["options"]) {
  let colorOptionPosition: number | null = null;
  let sizeOptionPosition: number | null = null;

  for (const opt of options) {
    const lower = opt.name.toLowerCase();
    if (COLOR_OPTION_NAMES.includes(lower)) colorOptionPosition = opt.position;
    else if (SIZE_OPTION_NAMES.includes(lower)) sizeOptionPosition = opt.position;
  }

  return { colorOptionPosition, sizeOptionPosition };
}

function getOptionValue(variant: ShopifyVariant, position: number): string {
  if (position === 1) return variant.option1 || "";
  if (position === 2) return variant.option2 || "";
  if (position === 3) return variant.option3 || "";
  return "";
}

interface ColorGroup {
  color: string | null;
  variants: { variant_id: string; size: string; price: string; available: boolean; inventory_item_id: string }[];
  primaryVariantId: string;
  price: number;
  imageUrl: string | null;
}

// Always store the plain numeric Shopify variant id (no `gid://...` prefix),
// since Shopify's AJAX cart API (/cart/add.js) requires numeric ids.
function toNumericId(raw: unknown): string {
  if (raw == null) return "";
  const s = String(raw).split("?")[0];
  const tail = s.includes("/") ? s.slice(s.lastIndexOf("/") + 1) : s;
  const m = tail.match(/\d+/g);
  if (!m || !m.length) return "";
  return m.reduce((a, b) => (b.length > a.length ? b : a));
}

function groupVariantsByColor(product: ShopifyProduct): ColorGroup[] {
  const { colorOptionPosition, sizeOptionPosition } = identifyOptionAxes(product.options);

  // No color option → single group for entire product
  if (!colorOptionPosition) {
    const variants = product.variants.map((v) => ({
      variant_id: toNumericId(v.id),
      size: sizeOptionPosition ? getOptionValue(v, sizeOptionPosition) : v.title,
      price: v.price,
      available: (v.inventory_quantity ?? 1) > 0,
      inventory_item_id: String(v.inventory_item_id ?? ""),
    }));
    return [{
      color: null,
      variants,
      primaryVariantId: toNumericId(product.variants[0]?.id),
      price: parseFloat(product.variants[0]?.price || "0"),
      imageUrl: product.images[0]?.src || null,
    }];
  }

  // Group by color
  const groups: Record<string, ColorGroup> = {};

  for (const variant of product.variants) {
    const colorValue = getOptionValue(variant, colorOptionPosition);
    const sizeValue = sizeOptionPosition
      ? getOptionValue(variant, sizeOptionPosition)
      : variant.title;

    if (!groups[colorValue]) {
      // Try to find a color-specific image
      let imageUrl = product.images[0]?.src || null;
      const variantImage = product.images.find(
        (img) => img.variant_ids && img.variant_ids.includes(variant.id)
      );
      if (variantImage) imageUrl = variantImage.src;

      groups[colorValue] = {
        color: colorValue || null,
        variants: [],
        primaryVariantId: toNumericId(variant.id),
        price: parseFloat(variant.price),
        imageUrl,
      };
    }

    groups[colorValue].variants.push({
      variant_id: toNumericId(variant.id),
      size: sizeValue,
      price: variant.price,
      available: (variant.inventory_quantity ?? 1) > 0,
      inventory_item_id: String(variant.inventory_item_id ?? ""),
    });
  }

  return Object.values(groups);
}

async function fetchAllProducts(shop: string, accessToken: string): Promise<ShopifyProduct[]> {
  const allProducts: ShopifyProduct[] = [];
  let nextUrl = `https://${shop}/admin/api/2025-01/products.json?limit=250`;

  while (nextUrl) {
    console.log(`[PRODUCT-SYNC] Fetching products from: ${nextUrl.substring(0, 80)}...`);

    const response = await fetch(nextUrl, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch products: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    allProducts.push(...data.products);

    const linkHeader = response.headers.get("Link");
    nextUrl = "";
    if (linkHeader) {
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      if (nextMatch) nextUrl = nextMatch[1];
    }

    console.log(`[PRODUCT-SYNC] Fetched ${data.products.length} products, total: ${allProducts.length}`);
  }

  return allProducts;
}

async function fetchWebhooks(shop: string, accessToken: string): Promise<ShopifyWebhook[]> {
  const response = await fetch(`https://${shop}/admin/api/2025-01/webhooks.json`, {
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    console.error(`Failed to fetch webhooks: ${response.status}`);
    return [];
  }

  const data = await response.json();
  return data.webhooks || [];
}

// Build a map of shopify_product_id -> array of collection summaries
async function fetchProductCollectionsMap(
  shop: string,
  accessToken: string
): Promise<Record<string, { id: string; title: string; handle: string }[]>> {
  const map: Record<string, { id: string; title: string; handle: string }[]> = {};

  async function fetchCollections(endpoint: "custom_collections" | "smart_collections") {
    let nextUrl = `https://${shop}/admin/api/2025-01/${endpoint}.json?limit=250`;
    const collections: { id: number; title: string; handle: string }[] = [];
    while (nextUrl) {
      const res = await fetch(nextUrl, {
        headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
      });
      if (!res.ok) {
        console.error(`[PRODUCT-SYNC] Failed to fetch ${endpoint}: ${res.status}`);
        return collections;
      }
      const data = await res.json();
      collections.push(...(data[endpoint] || []));
      const link = res.headers.get("Link");
      nextUrl = "";
      if (link) {
        const m = link.match(/<([^>]+)>;\s*rel="next"/);
        if (m) nextUrl = m[1];
      }
    }
    return collections;
  }

  async function fetchCollects(collectionId: number): Promise<number[]> {
    const productIds: number[] = [];
    let nextUrl = `https://${shop}/admin/api/2025-01/collects.json?collection_id=${collectionId}&limit=250`;
    while (nextUrl) {
      const res = await fetch(nextUrl, {
        headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
      });
      if (!res.ok) return productIds;
      const data = await res.json();
      for (const c of data.collects || []) productIds.push(c.product_id);
      const link = res.headers.get("Link");
      nextUrl = "";
      if (link) {
        const m = link.match(/<([^>]+)>;\s*rel="next"/);
        if (m) nextUrl = m[1];
      }
    }
    return productIds;
  }

  async function fetchSmartCollectionProducts(collectionId: number): Promise<number[]> {
    const productIds: number[] = [];
    let nextUrl = `https://${shop}/admin/api/2025-01/collections/${collectionId}/products.json?limit=250`;
    while (nextUrl) {
      const res = await fetch(nextUrl, {
        headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
      });
      if (!res.ok) return productIds;
      const data = await res.json();
      for (const p of data.products || []) productIds.push(p.id);
      const link = res.headers.get("Link");
      nextUrl = "";
      if (link) {
        const m = link.match(/<([^>]+)>;\s*rel="next"/);
        if (m) nextUrl = m[1];
      }
    }
    return productIds;
  }

  try {
    const [custom, smart] = await Promise.all([
      fetchCollections("custom_collections"),
      fetchCollections("smart_collections"),
    ]);

    for (const col of custom) {
      const productIds = await fetchCollects(col.id);
      for (const pid of productIds) {
        const key = String(pid);
        if (!map[key]) map[key] = [];
        map[key].push({ id: String(col.id), title: col.title, handle: col.handle });
      }
    }

    for (const col of smart) {
      const productIds = await fetchSmartCollectionProducts(col.id);
      for (const pid of productIds) {
        const key = String(pid);
        if (!map[key]) map[key] = [];
        map[key].push({ id: String(col.id), title: col.title, handle: col.handle });
      }
    }
  } catch (err) {
    console.error("[PRODUCT-SYNC] Error fetching collections:", err);
  }

  return map;
}

async function createSyncHistoryEntry(supabase: any, brandId: string, syncType: string) {
  const { data, error } = await supabase
    .from("sync_history")
    .insert({ brand_id: brandId, sync_type: syncType, status: "in_progress" })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating sync history:", error);
    return null;
  }
  return data?.id;
}

async function updateSyncHistoryEntry(supabase: any, historyId: string, updates: Record<string, any>) {
  const { error } = await supabase
    .from("sync_history")
    .update({
      ...updates,
      completed_at: updates.status === "completed" || updates.status === "failed" ? new Date().toISOString() : null,
    })
    .eq("id", historyId);

  if (error) console.error("Error updating sync history:", error);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brand_id, action } = await req.json();
    console.log(`[PRODUCT-SYNC] Starting sync for brand: ${brand_id}, action: ${action}`);

    if (!brand_id) {
      return new Response(
        JSON.stringify({ error: "brand_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("shopify_store_domain, shopify_access_token")
      .eq("id", brand_id)
      .single();

    if (brandError || !brand) {
      return new Response(
        JSON.stringify({ error: "Brand not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!brand.shopify_store_domain || !brand.shopify_access_token) {
      return new Response(
        JSON.stringify({ error: "Shopify not connected for this brand" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle register-webhooks action
    if (action === "register-webhooks") {
      const EXPECTED_TOPICS = [
        "products/create",
        "products/update",
        "products/delete",
        "inventory_levels/update",
        "app/uninstalled",
      ];

      const existingWebhooks = await fetchWebhooks(brand.shopify_store_domain, brand.shopify_access_token);
      const existingTopics = existingWebhooks.map((w) => w.topic);
      const missingTopics = EXPECTED_TOPICS.filter((t) => !existingTopics.includes(t));

      if (missingTopics.length === 0) {
        return new Response(
          JSON.stringify({ registered: [], message: "All webhooks already registered" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const webhookBaseUrl = `${SUPABASE_URL}/functions/v1/shopify-webhooks`;
      const registered: string[] = [];
      const failed: string[] = [];

      for (const topic of missingTopics) {
        try {
          const res = await fetch(
            `https://${brand.shopify_store_domain}/admin/api/2025-01/webhooks.json`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": brand.shopify_access_token,
              },
              body: JSON.stringify({
                webhook: { topic, address: webhookBaseUrl, format: "json" },
              }),
            }
          );

          if (res.ok || res.status === 422) {
            registered.push(topic);
          } else {
            const body = await res.text();
            console.error(`[PRODUCT-SYNC] Failed to register ${topic}: ${res.status} ${body}`);
            failed.push(topic);
          }
        } catch (err) {
          console.error(`[PRODUCT-SYNC] Error registering ${topic}:`, err);
          failed.push(topic);
        }
      }

      console.log(`[PRODUCT-SYNC] Registered ${registered.length}/${missingTopics.length} webhooks`);

      return new Response(
        JSON.stringify({ registered, failed, total: EXPECTED_TOPICS.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle webhook status action
    if (action === "webhooks") {
      const webhooks = await fetchWebhooks(brand.shopify_store_domain, brand.shopify_access_token);
      return new Response(
        JSON.stringify({
          webhooks: webhooks.map((w) => ({
            topic: w.topic,
            address: w.address,
            created_at: w.created_at,
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "status") {
      const { count: productCount } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("brand_id", brand_id);

      const { count: syncedCount } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("brand_id", brand_id)
        .not("shopify_product_id", "is", null);

      const { data: latestSync } = await supabase
        .from("products")
        .select("updated_at")
        .eq("brand_id", brand_id)
        .not("shopify_product_id", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      return new Response(
        JSON.stringify({
          totalProducts: productCount || 0,
          syncedProducts: syncedCount || 0,
          lastSyncAt: latestSync?.updated_at || null,
          storeDomain: brand.shopify_store_domain,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Full sync
    const historyId = await createSyncHistoryEntry(supabase, brand_id, "manual");

    let products: ShopifyProduct[];
    try {
      products = await fetchAllProducts(brand.shopify_store_domain, brand.shopify_access_token);
    } catch (fetchError) {
      if (historyId) {
        await updateSyncHistoryEntry(supabase, historyId, {
          status: "failed",
          error_message: fetchError instanceof Error ? fetchError.message : String(fetchError),
        });
      }
      throw fetchError;
    }

    console.log(`[PRODUCT-SYNC] Got ${products.length} products from Shopify`);

    // Fetch collections map (best-effort; failures don't block sync)
    const collectionsMap = await fetchProductCollectionsMap(
      brand.shopify_store_domain,
      brand.shopify_access_token
    );
    console.log(`[PRODUCT-SYNC] Loaded collections for ${Object.keys(collectionsMap).length} products`);

    let created = 0;
    let updated = 0;
    let deleted = 0;
    const errors: string[] = [];

    // Track all DB row IDs we upsert so we can clean up stale rows
    const upsertedRowIds: string[] = [];

    for (const product of products) {
      const colorGroups = groupVariantsByColor(product);

      const productTags = (product.tags || "")
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const imagesJson = (product.images || []).map((img) => ({
        id: img.id ? String(img.id) : null,
        src: img.src,
        alt: img.alt ?? null,
        position: img.position ?? null,
        width: img.width ?? null,
        height: img.height ?? null,
        variant_ids: (img.variant_ids || []).map(String),
      }));

      const productCollections = collectionsMap[String(product.id)] || [];

      for (const group of colorGroups) {
        const name = group.color
          ? `${product.title} - ${group.color}`
          : product.title;

        const productData = {
          brand_id,
          name,
          category: product.product_type?.toLowerCase() || "uncategorized",
          product_type: product.product_type || null,
          tags: productTags,
          collections: productCollections,
          images_json: imagesJson,
          price: group.price,
          image_url: group.imageUrl,
          color: group.color?.toLowerCase() || null,
          shopify_product_id: String(product.id),
          shopify_variant_id: group.primaryVariantId,
          shopify_handle: product.handle,
          inventory_status: "in_stock",
          source: "shopify",
          variants_json: group.variants,
        };


        // Upsert by brand_id + shopify_product_id + primary variant
        const { data: existing } = await supabase
          .from("products")
          .select("id")
          .eq("brand_id", brand_id)
          .eq("shopify_variant_id", group.primaryVariantId)
          .single();

        if (existing) {
          const { error } = await supabase.from("products").update(productData).eq("id", existing.id);
          if (error) errors.push(`Update ${name}: ${error.message}`);
          else { updated++; upsertedRowIds.push(existing.id); }
        } else {
          const { data: inserted, error } = await supabase.from("products").insert(productData).select("id").single();
          if (error) errors.push(`Create ${name}: ${error.message}`);
          else { created++; if (inserted) upsertedRowIds.push(inserted.id); }
        }
      }
    }

    // Clean up ALL other rows for these Shopify products (old per-variant duplicates)
    const allShopifyProductIds = [...new Set(products.map((p) => String(p.id)))];
    if (allShopifyProductIds.length > 0 && upsertedRowIds.length > 0) {
      const { data: allRows } = await supabase
        .from("products")
        .select("id")
        .eq("brand_id", brand_id)
        .in("shopify_product_id", allShopifyProductIds);

      if (allRows) {
        const keepSet = new Set(upsertedRowIds);
        const staleIds = allRows
          .filter((r: any) => !keepSet.has(r.id))
          .map((r: any) => r.id);

        if (staleIds.length > 0) {
          for (let i = 0; i < staleIds.length; i += 100) {
            const batch = staleIds.slice(i, i + 100);
            const { error: delError } = await supabase.from("products").delete().in("id", batch);
            if (delError) errors.push(`Cleanup batch: ${delError.message}`);
          }
          deleted = staleIds.length;
          console.log(`[PRODUCT-SYNC] Cleaned up ${staleIds.length} stale variant rows`);
        }
      }
    }

    if (historyId) {
      await updateSyncHistoryEntry(supabase, historyId, {
        status: "completed",
        products_created: created,
        products_updated: updated,
        products_deleted: deleted,
        error_message: errors.length > 0 ? errors.slice(0, 5).join("; ") : undefined,
      });
    }

    console.log(`[PRODUCT-SYNC] Sync complete: ${created} created, ${updated} updated, ${deleted} deleted, ${errors.length} errors`);

    return new Response(
      JSON.stringify({ success: true, created, updated, deleted, total: products.length, errors: errors.slice(0, 10) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[PRODUCT-SYNC] Error:`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
