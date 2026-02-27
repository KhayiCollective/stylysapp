import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-shopify-topic, x-shopify-hmac-sha256, x-shopify-shop-domain, x-shopify-api-version",
};

const SHOPIFY_CLIENT_SECRET = Deno.env.get("SHOPIFY_CLIENT_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Timing-safe comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

// Verify Shopify webhook HMAC signature (strict)
async function verifyWebhookSignature(
  rawBody: string,
  hmacHeader: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(rawBody);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const calculatedHmac = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

  return timingSafeEqual(calculatedHmac, hmacHeader);
}

// Get brand by shop domain
async function getBrandByShop(supabase: any, shopDomain: string) {
  let { data, error } = await supabase
    .from("brands")
    .select("id, name, shopify_store_domain")
    .eq("shopify_store_domain", shopDomain)
    .single();

  if (error || !data) {
    const cleanDomain = shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const result = await supabase
      .from("brands")
      .select("id, name, shopify_store_domain")
      .eq("shopify_store_domain", cleanDomain)
      .single();
    data = result.data;
    error = result.error;
  }

  if (error) {
    console.error("Error fetching brand:", error);
    return null;
  }
  return data;
}

// Map Shopify product to our schema
function mapShopifyProduct(shopifyProduct: any, brandId: string) {
  const products: any[] = [];

  for (const variant of shopifyProduct.variants || []) {
    const product = {
      brand_id: brandId,
      name: shopifyProduct.variants.length > 1
        ? `${shopifyProduct.title} - ${variant.title}`
        : shopifyProduct.title,
      shopify_product_id: String(shopifyProduct.id),
      shopify_variant_id: `gid://shopify/ProductVariant/${variant.id}`,
      shopify_handle: shopifyProduct.handle,
      price: parseFloat(variant.price) || 0,
      image_url: shopifyProduct.image?.src || shopifyProduct.images?.[0]?.src || null,
      category: shopifyProduct.product_type || "Uncategorized",
      inventory_status: variant.inventory_quantity > 0 ? "in_stock" : "out_of_stock",
      color: null,
      fit: null,
    };
    products.push(product);
  }

  return products;
}

// Create sync history entry
async function createSyncHistoryEntry(
  supabase: any,
  brandId: string,
  syncType: string,
  created: number = 0,
  updated: number = 0,
  deleted: number = 0,
  errorMessage: string | null = null
) {
  const { error } = await supabase
    .from("sync_history")
    .insert({
      brand_id: brandId,
      sync_type: syncType,
      status: errorMessage ? "failed" : "completed",
      products_created: created,
      products_updated: updated,
      products_deleted: deleted,
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    });

  if (error) {
    console.error("Error creating sync history:", error);
  }
}

// Handle product creation/update
async function handleProductCreateOrUpdate(
  supabase: any,
  brandId: string,
  shopifyProduct: any
) {
  console.log(`Processing product: ${shopifyProduct.title} (ID: ${shopifyProduct.id})`);

  const products = mapShopifyProduct(shopifyProduct, brandId);
  let created = 0;
  let updated = 0;

  for (const product of products) {
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("brand_id", brandId)
      .eq("shopify_variant_id", product.shopify_variant_id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("products")
        .update({
          name: product.name,
          price: product.price,
          image_url: product.image_url,
          category: product.category,
          inventory_status: product.inventory_status,
        })
        .eq("id", existing.id);

      if (error) {
        console.error("Error updating product:", error);
      } else {
        updated++;
      }
    } else {
      const { error } = await supabase
        .from("products")
        .insert(product);

      if (error) {
        console.error("Error inserting product:", error);
      } else {
        created++;
      }
    }
  }

  await createSyncHistoryEntry(supabase, brandId, "webhook", created, updated, 0);
  return { synced: products.length, created, updated };
}

// Handle product deletion
async function handleProductDelete(
  supabase: any,
  brandId: string,
  shopifyProduct: any
) {
  const shopifyProductId = String(shopifyProduct.id);
  console.log(`Deleting product: ${shopifyProductId}`);

  const { count: deleteCount } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .eq("shopify_product_id", shopifyProductId);

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("brand_id", brandId)
    .eq("shopify_product_id", shopifyProductId);

  if (error) {
    console.error("Error deleting product:", error);
    await createSyncHistoryEntry(supabase, brandId, "webhook", 0, 0, 0, error.message);
    return { deleted: 0 };
  }

  const deleted = deleteCount || 0;
  await createSyncHistoryEntry(supabase, brandId, "webhook", 0, 0, deleted);
  return { deleted };
}

// Handle customers/data_request — acknowledge the request
async function handleCustomerDataRequest(
  supabase: any,
  brandId: string,
  payload: any
) {
  const email = payload?.customer?.email;
  console.log(`Customer data request for: ${email ? "***" : "unknown"}`);

  if (email) {
    const { data } = await supabase
      .from("customers")
      .select("id")
      .eq("brand_id", brandId)
      .eq("email", email)
      .maybeSingle();

    console.log(`Customer record found: ${!!data}`);
  }

  // Shopify requires a 200 acknowledgment; actual data export is handled offline
  return { acknowledged: true, topic: "customers/data_request" };
}

// Handle customers/redact — delete customer data
async function handleCustomerRedact(
  supabase: any,
  brandId: string,
  payload: any
) {
  const email = payload?.customer?.email;
  console.log(`Customer redact request for brand: ${brandId}`);

  if (!email) {
    console.warn("No customer email in redact payload");
    return { redacted: false, reason: "no_email" };
  }

  // Find matching customer
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("brand_id", brandId)
    .eq("email", email)
    .maybeSingle();

  if (!customer) {
    return { redacted: true, reason: "no_matching_record" };
  }

  // Delete customer_accounts linked to this customer
  await supabase
    .from("customer_accounts")
    .delete()
    .eq("brand_id", brandId)
    .eq("customer_id", customer.id);

  // Delete saved_outfits linked to customer_accounts for this brand/email
  // (customer_accounts already deleted, but saved_outfits reference customer_account_id)

  // Delete recommendations for this customer
  await supabase
    .from("recommendations")
    .delete()
    .eq("brand_id", brandId)
    .eq("customer_id", customer.id);

  // Delete the customer record itself
  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", customer.id);

  if (error) {
    console.error("Error deleting customer:", error);
    return { redacted: false, error: error.message };
  }

  console.log(`Customer redacted: ${customer.id}`);
  return { redacted: true };
}

// Handle shop/redact — full data erasure for a shop
async function handleShopRedact(
  supabase: any,
  brandId: string,
  _payload: any
) {
  console.log(`Shop redact for brand: ${brandId} — erasing all data`);

  // Delete in dependency order: outfit_items → outfits, recommendations, products, customers, customer_accounts, saved_outfits, rules, widget_config, sync_history

  // outfit_items (depends on outfits)
  const { data: outfits } = await supabase
    .from("outfits")
    .select("id")
    .eq("brand_id", brandId);

  if (outfits?.length) {
    const outfitIds = outfits.map((o: any) => o.id);
    await supabase
      .from("outfit_items")
      .delete()
      .in("outfit_id", outfitIds);
  }

  // Delete from all brand-scoped tables
  const tables = [
    "recommendations",
    "outfits",
    "saved_outfits",
    "customer_accounts",
    "customers",
    "products",
    "rules",
    "widget_config",
    "sync_history",
    "support_tickets",
    "onboarding_progress",
  ];

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("brand_id", brandId);

    if (error) {
      console.error(`Error deleting from ${table}:`, error);
    }
  }

  // Clear brand tokens (don't delete the brand row — keep for audit)
  await supabase
    .from("brands")
    .update({
      shopify_access_token: null,
      shopify_storefront_token: null,
      shopify_connected_at: null,
      widget_script_tag_id: null,
    })
    .eq("id", brandId);

  console.log(`Shop redact complete for brand: ${brandId}`);
  return { redacted: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const topic = req.headers.get("x-shopify-topic");
    const hmac = req.headers.get("x-shopify-hmac-sha256");
    const shopDomain = req.headers.get("x-shopify-shop-domain");

    console.log("Webhook received:", { topic, shopDomain });

    if (!topic || !shopDomain) {
      return new Response(
        JSON.stringify({ error: "Missing required Shopify headers" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Strict HMAC verification — always required
    if (!hmac || !SHOPIFY_CLIENT_SECRET) {
      console.error("Missing HMAC header or SHOPIFY_CLIENT_SECRET");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawBody = await req.text();

    const isValid = await verifyWebhookSignature(rawBody, hmac, SHOPIFY_CLIENT_SECRET);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Webhook signature verification: PASSED");

    const payload = JSON.parse(rawBody);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const brand = await getBrandByShop(supabase, shopDomain);
    if (!brand) {
      console.error("Brand not found for shop:", shopDomain);
      return new Response(
        JSON.stringify({ acknowledged: true, warning: "Brand not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing webhook for brand: ${brand.name} (${brand.id})`);

    let result = {};

    switch (topic) {
      case "products/create":
      case "products/update":
        result = await handleProductCreateOrUpdate(supabase, brand.id, payload);
        break;

      case "products/delete":
        result = await handleProductDelete(supabase, brand.id, payload);
        break;

      case "inventory_levels/update": {
        const variantId = `gid://shopify/ProductVariant/${payload.inventory_item_id}`;
        const newStatus = payload.available > 0 ? "in_stock" : "out_of_stock";

        const { error: inventoryError } = await supabase
          .from("products")
          .update({ inventory_status: newStatus })
          .eq("brand_id", brand.id)
          .eq("shopify_variant_id", variantId);

        if (inventoryError) {
          console.error("Error updating inventory:", inventoryError);
        }
        result = { updated_inventory: true };
        break;
      }

      case "app/uninstalled":
        await supabase
          .from("brands")
          .update({
            shopify_access_token: null,
            shopify_storefront_token: null,
            shopify_connected_at: null,
          })
          .eq("id", brand.id);
        result = { disconnected: true };
        console.log(`App uninstalled for brand: ${brand.name}`);
        break;

      case "customers/data_request":
        result = await handleCustomerDataRequest(supabase, brand.id, payload);
        break;

      case "customers/redact":
        result = await handleCustomerRedact(supabase, brand.id, payload);
        break;

      case "shop/redact":
        result = await handleShopRedact(supabase, brand.id, payload);
        break;

      default:
        console.log(`Unhandled webhook topic: ${topic}`);
        result = { acknowledged: true, topic };
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const error = err as Error;
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
