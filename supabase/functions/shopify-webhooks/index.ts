import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-shopify-topic, x-shopify-hmac-sha256, x-shopify-shop-domain, x-shopify-api-version",
};

const SHOPIFY_CLIENT_SECRET = Deno.env.get("SHOPIFY_CLIENT_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Verify Shopify webhook HMAC signature
async function verifyWebhookSignature(
  rawBody: string,
  hmacHeader: string,
  secret: string
): Promise<boolean> {
  if (!hmacHeader || !secret) {
    console.log("Missing HMAC header or secret");
    return false;
  }

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

  const isValid = calculatedHmac === hmacHeader;
  console.log("Webhook signature verification:", isValid ? "PASSED" : "FAILED");
  return isValid;
}

// Get brand by shop domain
async function getBrandByShop(supabase: any, shopDomain: string) {
  // Try exact match first
  let { data, error } = await supabase
    .from("brands")
    .select("id, name, shopify_store_domain")
    .eq("shopify_store_domain", shopDomain)
    .single();

  if (error || !data) {
    // Try without protocol
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

  // Create a product entry for each variant
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
      color: extractOption(variant, "Color") || extractOption(variant, "Colour"),
      fit: extractOption(variant, "Size") || extractOption(variant, "Fit"),
    };
    products.push(product);
  }

  return products;
}

// Extract option value from variant
function extractOption(variant: any, optionName: string): string | null {
  if (!variant.option1 && !variant.option2 && !variant.option3) return null;
  
  // We don't have option names in webhook payload, just values
  // This is a simplified version - in production you might need to fetch product options
  return null;
}

// Handle product creation/update
async function handleProductCreateOrUpdate(
  supabase: any,
  brandId: string,
  shopifyProduct: any
) {
  console.log(`Processing product: ${shopifyProduct.title} (ID: ${shopifyProduct.id})`);
  
  const products = mapShopifyProduct(shopifyProduct, brandId);
  
  for (const product of products) {
    // Upsert each variant
    const { error } = await supabase
      .from("products")
      .upsert(product, {
        onConflict: "brand_id,shopify_variant_id",
        ignoreDuplicates: false,
      });

    if (error) {
      console.error("Error upserting product:", error);
      
      // If upsert fails due to constraint, try update
      if (error.code === "23505") {
        const { error: updateError } = await supabase
          .from("products")
          .update({
            name: product.name,
            price: product.price,
            image_url: product.image_url,
            category: product.category,
            inventory_status: product.inventory_status,
          })
          .eq("brand_id", brandId)
          .eq("shopify_variant_id", product.shopify_variant_id);

        if (updateError) {
          console.error("Error updating product:", updateError);
        } else {
          console.log(`Updated variant: ${product.shopify_variant_id}`);
        }
      }
    } else {
      console.log(`Upserted variant: ${product.shopify_variant_id}`);
    }
  }

  return { synced: products.length };
}

// Handle product deletion
async function handleProductDelete(
  supabase: any,
  brandId: string,
  shopifyProduct: any
) {
  const shopifyProductId = String(shopifyProduct.id);
  console.log(`Deleting product: ${shopifyProductId}`);

  const { error, count } = await supabase
    .from("products")
    .delete()
    .eq("brand_id", brandId)
    .eq("shopify_product_id", shopifyProductId);

  if (error) {
    console.error("Error deleting product:", error);
    return { deleted: 0 };
  }

  console.log(`Deleted ${count || 0} variants for product ${shopifyProductId}`);
  return { deleted: count || 0 };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get webhook headers
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

    // Get raw body for HMAC verification
    const rawBody = await req.text();
    
    // Verify webhook signature
    if (SHOPIFY_CLIENT_SECRET && hmac) {
      const isValid = await verifyWebhookSignature(rawBody, hmac, SHOPIFY_CLIENT_SECRET);
      if (!isValid) {
        console.error("Invalid webhook signature");
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Parse the body
    const payload = JSON.parse(rawBody);

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get brand by shop domain
    const brand = await getBrandByShop(supabase, shopDomain);
    if (!brand) {
      console.error("Brand not found for shop:", shopDomain);
      // Return 200 to acknowledge receipt (Shopify will retry on non-2xx)
      return new Response(
        JSON.stringify({ acknowledged: true, warning: "Brand not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing webhook for brand: ${brand.name} (${brand.id})`);

    let result = {};

    // Route based on topic
    switch (topic) {
      case "products/create":
      case "products/update":
        result = await handleProductCreateOrUpdate(supabase, brand.id, payload);
        break;

      case "products/delete":
        result = await handleProductDelete(supabase, brand.id, payload);
        break;

      case "inventory_levels/update":
        // Handle inventory update
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

      case "app/uninstalled":
        // Mark brand as disconnected
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
