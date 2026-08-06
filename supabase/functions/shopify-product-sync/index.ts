import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyShopifySessionToken } from "../_shared/shopify-session-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-shopify-session-token",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SHOPIFY_CLIENT_ID = Deno.env.get("SHOPIFY_CLIENT_ID") || "";
const SHOPIFY_CLIENT_SECRET = Deno.env.get("SHOPIFY_CLIENT_SECRET") || "";

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
  let cursor: string | null = null;
  let hasNextPage = true;

  // Confirmed query cost: 673 requested / 13 actual at 250/250/250 against
  // stylys-2.myshopify.com (well under the 1000-point single-query hard ceiling).
  const query = `
    query($cursor: String) {
      products(first: 250, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          legacyResourceId
          title
          handle
          productType
          tags
          status
          options { name position values }
          images(first: 250) {
            nodes { id url altText width height }
          }
          variants(first: 250) {
            nodes {
              legacyResourceId
              title
              price
              selectedOptions { name value }
              inventoryQuantity
              inventoryItem { legacyResourceId }
              image { id }
            }
          }
        }
      }
    }
  `;

  const doFetch = () => fetch(`https://${shop}/admin/api/2025-01/graphql.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { cursor } }),
  });

  while (hasNextPage) {
    console.log(`[PRODUCT-SYNC] Fetching products via GraphQL, cursor: ${cursor ? cursor.substring(0, 20) + "..." : "start"}`);

    // Initialize response immediately to avoid uninitialized-variable TypeScript concerns.
    let response = await doFetch();
    for (let attempt = 0; response.status === 429; attempt++) {
      if (attempt >= 3) throw new Error("GraphQL throttled after 3 retries");
      const retryAfter = parseFloat(response.headers.get("Retry-After") ?? "2");
      console.warn(`[PRODUCT-SYNC] GraphQL throttled — retrying in ${retryAfter}s (attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      response = await doFetch();
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch products: ${response.status} ${await response.text()}`);
    }

    const json = await response.json();
    const connection = json?.data?.products;

    if (!connection) {
      throw new Error(`GraphQL products query returned no data: ${JSON.stringify(json?.errors)}`);
    }

    for (const gqlProduct of connection.nodes) {
      // Reconstruct variant_ids per image: REST had image.variant_ids[]; GraphQL
      // inverts this — ProductVariant.image.id points to the variant's image.
      // image.id is nullable on the Image type; skip nulls to avoid bad map keys.
      const variantImageMap: Record<string, number[]> = {};
      for (const v of gqlProduct.variants.nodes) {
        const imgId: string | null | undefined = v.image?.id;
        if (imgId) {
          if (!variantImageMap[imgId]) variantImageMap[imgId] = [];
          variantImageMap[imgId].push(Number(v.legacyResourceId));
        }
      }

      const images: ShopifyImage[] = gqlProduct.images.nodes.map(
        (img: any, index: number) => ({
          id: img.id ? Number(toNumericId(img.id)) : undefined,
          src: img.url,
          alt: img.altText ?? null,
          position: index + 1,
          width: img.width ?? null,
          height: img.height ?? null,
          variant_ids: img.id ? (variantImageMap[img.id] ?? []) : [],
        })
      );

      const variants: ShopifyVariant[] = gqlProduct.variants.nodes.map((v: any) => ({
        id: Number(v.legacyResourceId),
        price: v.price,
        title: v.title,
        option1: v.selectedOptions[0]?.value ?? null,
        option2: v.selectedOptions[1]?.value ?? null,
        option3: v.selectedOptions[2]?.value ?? null,
        inventory_quantity: v.inventoryQuantity ?? 0,
        inventory_item_id: v.inventoryItem?.legacyResourceId
          ? Number(v.inventoryItem.legacyResourceId)
          : undefined,
      }));

      allProducts.push({
        id: Number(gqlProduct.legacyResourceId),
        title: gqlProduct.title,
        handle: gqlProduct.handle,
        product_type: gqlProduct.productType,
        tags: gqlProduct.tags.join(","), // GQL returns string[]; downstream splits on comma
        status: gqlProduct.status?.toLowerCase(),
        images,
        variants,
        options: gqlProduct.options,
      });
    }

    hasNextPage = connection.pageInfo.hasNextPage;
    cursor = connection.pageInfo.endCursor;
    console.log(`[PRODUCT-SYNC] Fetched ${connection.nodes.length} products, total: ${allProducts.length}`);
  }

  return allProducts;
}

async function fetchWebhooks(shop: string, accessToken: string): Promise<ShopifyWebhook[]> {
  const query = `
    query($cursor: String) {
      webhookSubscriptions(first: 250, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          legacyResourceId
          topic
          createdAt
          endpoint {
            ... on WebhookHttpEndpoint { callbackUrl }
          }
        }
      }
    }
  `;

  const webhooks: ShopifyWebhook[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const response: Response = await fetch(`https://${shop}/admin/api/2025-01/graphql.json`, {
      method: "POST",
      headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { cursor } }),
    });

    if (!response.ok) {
      console.error(`Failed to fetch webhooks: ${response.status}`);
      return webhooks;
    }

    const json: any = await response.json();
    const connection: any = json?.data?.webhookSubscriptions;

    if (!connection) {
      console.error("Failed to fetch webhooks: no data returned", json?.errors);
      return webhooks;
    }

    for (const node of connection.nodes) {
      webhooks.push({
        id: Number(node.legacyResourceId),
        // GraphQL returns topic as enum (e.g. PRODUCTS_CREATE); normalize to the
        // REST slash format (e.g. products/create) that WebhookStatusIndicator compares against.
        topic: node.topic.toLowerCase().replace(/_([^_]+)$/, "/$1"),
        address: node.endpoint?.callbackUrl ?? "",
        created_at: node.createdAt,
      });
    }

    hasNextPage = connection.pageInfo.hasNextPage;
    cursor = connection.pageInfo.endCursor;
  }

  return webhooks;
}

// Build a map of shopify_product_id -> array of collection summaries
async function fetchProductCollectionsMap(
  shop: string,
  accessToken: string
): Promise<Record<string, { id: string; title: string; handle: string }[]>> {
  const map: Record<string, { id: string; title: string; handle: string }[]> = {};

  // Replaces four REST endpoints: custom_collections.json, smart_collections.json,
  // collects.json, and collections/{id}/products.json. Custom and smart collections
  // are unified — the GraphQL collections query returns both.
  const collectionsQuery = `
    query($cursor: String) {
      collections(first: 250, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          legacyResourceId
          title
          handle
          products(first: 250) {
            pageInfo { hasNextPage endCursor }
            nodes { legacyResourceId }
          }
        }
      }
    }
  `;

  // Used only when a collection's products connection has >250 members.
  const collectionProductsQuery = `
    query($id: ID!, $cursor: String) {
      collection(id: $id) {
        products(first: 250, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          nodes { legacyResourceId }
        }
      }
    }
  `;

  const gqlFetch = (body: unknown) =>
    fetch(`https://${shop}/admin/api/2025-01/graphql.json`, {
      method: "POST",
      headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  try {
    let cursor: string | null = null;
    let hasNextPage = true;

    while (hasNextPage) {
      const res = await gqlFetch({ query: collectionsQuery, variables: { cursor } });

      if (!res.ok) {
        console.error(`[PRODUCT-SYNC] Failed to fetch collections: ${res.status}`);
        break;
      }

      const json = await res.json();
      const connection = json?.data?.collections;

      if (!connection) {
        console.error("[PRODUCT-SYNC] GraphQL collections query returned no data:", json?.errors);
        break;
      }

      for (const col of connection.nodes) {
        const colSummary = { id: col.legacyResourceId, title: col.title, handle: col.handle };

        for (const product of col.products.nodes) {
          const key = product.legacyResourceId;
          if (!map[key]) map[key] = [];
          map[key].push(colSummary);
        }

        // Paginate overflow: fires only when a collection has >250 products.
        if (col.products.pageInfo.hasNextPage) {
          console.log(`[PRODUCT-SYNC] Collection "${col.title}" (${col.legacyResourceId}) has >250 products — paginating`);
          const collectionGid = `gid://shopify/Collection/${col.legacyResourceId}`;
          let productCursor: string = col.products.pageInfo.endCursor;
          let moreProducts = true;

          while (moreProducts) {
            const overflowRes = await gqlFetch({
              query: collectionProductsQuery,
              variables: { id: collectionGid, cursor: productCursor },
            });

            if (!overflowRes.ok) {
              console.error(`[PRODUCT-SYNC] Failed to fetch products overflow for collection ${col.legacyResourceId}: ${overflowRes.status}`);
              break;
            }

            const overflowJson = await overflowRes.json();
            const productsConn = overflowJson?.data?.collection?.products;

            if (!productsConn) {
              console.error(`[PRODUCT-SYNC] No products data for collection ${col.legacyResourceId}:`, overflowJson?.errors);
              break;
            }

            for (const product of productsConn.nodes) {
              const key = product.legacyResourceId;
              if (!map[key]) map[key] = [];
              map[key].push(colSummary);
            }

            moreProducts = productsConn.pageInfo.hasNextPage;
            productCursor = productsConn.pageInfo.endCursor;
          }
        }
      }

      hasNextPage = connection.pageInfo.hasNextPage;
      cursor = connection.pageInfo.endCursor;
      console.log(`[PRODUCT-SYNC] Fetched ${connection.nodes.length} collections, hasNextPage: ${hasNextPage}`);
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
    // Parse body once — action always comes from the body; brand_id used in standalone path
    let bodyBrandId: string | undefined;
    let action: string;
    try {
      const body = await req.json();
      bodyBrandId = body.brand_id;
      action = body.action;
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!action) {
      return new Response(
        JSON.stringify({ error: "action is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Auth: resolve authenticated brand_id
    let brand_id: string;
    const sessionToken = req.headers.get("X-Shopify-Session-Token");

    if (sessionToken) {
      // Embedded path: verify Shopify App Bridge session token
      try {
        const { brandId } = await verifyShopifySessionToken(
          sessionToken,
          supabase,
          SHOPIFY_CLIENT_ID,
          SHOPIFY_CLIENT_SECRET,
        );
        brand_id = brandId;
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid session token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Standalone path: verify Supabase user JWT from Authorization header
      const authHeader = req.headers.get("Authorization");
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

      if (!token) {
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser(token);

      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("brand_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.brand_id) {
        return new Response(
          JSON.stringify({ error: "User has no associated brand" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (bodyBrandId && bodyBrandId !== profile.brand_id) {
        return new Response(
          JSON.stringify({ error: "brand_id does not match authenticated user" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      brand_id = profile.brand_id;
    }

    console.log(`[PRODUCT-SYNC] Starting sync for brand: ${brand_id}, action: ${action}`);

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

    // register-webhooks: webhooks are managed declaratively via shopify.app.toml.
    // Retained for API compatibility with the frontend button; no REST calls made.
    if (action === "register-webhooks") {
      return new Response(
        JSON.stringify({ registered: [], failed: [], message: "Webhooks are managed via shopify app deploy" }),
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
