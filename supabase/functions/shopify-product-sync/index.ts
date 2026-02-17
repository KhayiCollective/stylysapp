// Using Deno.serve pattern
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  product_type: string;
  images: { src: string }[];
  variants: {
    id: number;
    price: string;
    title: string;
  }[];
}

interface ShopifyWebhook {
  id: number;
  topic: string;
  address: string;
  created_at: string;
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
    
    // Check for pagination via Link header
    const linkHeader = response.headers.get("Link");
    nextUrl = "";
    if (linkHeader) {
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      if (nextMatch) {
        nextUrl = nextMatch[1];
      }
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

async function createSyncHistoryEntry(
  supabase: any,
  brandId: string,
  syncType: string,
  status: string = "in_progress"
) {
  const { data, error } = await supabase
    .from("sync_history")
    .insert({
      brand_id: brandId,
      sync_type: syncType,
      status,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating sync history:", error);
    return null;
  }
  return data?.id;
}

async function updateSyncHistoryEntry(
  supabase: any,
  historyId: string,
  updates: {
    status?: string;
    products_created?: number;
    products_updated?: number;
    products_deleted?: number;
    error_message?: string;
  }
) {
  const { error } = await supabase
    .from("sync_history")
    .update({
      ...updates,
      completed_at: updates.status === "completed" || updates.status === "failed" ? new Date().toISOString() : null,
    })
    .eq("id", historyId);

  if (error) {
    console.error("Error updating sync history:", error);
  }
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

    // Get brand's Shopify credentials
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

    // Handle webhook status action
    if (action === "webhooks") {
      const webhooks = await fetchWebhooks(brand.shopify_store_domain, brand.shopify_access_token);
      return new Response(
        JSON.stringify({
          webhooks: webhooks.map(w => ({
            topic: w.topic,
            address: w.address,
            created_at: w.created_at,
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "status") {
      // Return sync status
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

    // Full sync - create history entry
    const historyId = await createSyncHistoryEntry(supabase, brand_id, "manual");

    console.log(`[PRODUCT-SYNC] Fetching products from Shopify: ${brand.shopify_store_domain}`);
    
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

    let created = 0;
    let updated = 0;
    let errors: string[] = [];

    for (const product of products) {
      for (const variant of product.variants) {
        const productData = {
          brand_id,
          name: variant.title !== "Default Title" ? `${product.title} - ${variant.title}` : product.title,
          category: product.product_type || "uncategorized",
          price: parseFloat(variant.price),
          image_url: product.images[0]?.src || null,
          shopify_product_id: String(product.id),
          shopify_variant_id: String(variant.id),
          shopify_handle: product.handle,
          inventory_status: "in_stock",
          source: "shopify",
        };

        // Upsert by shopify_variant_id
        const { data: existing } = await supabase
          .from("products")
          .select("id")
          .eq("brand_id", brand_id)
          .eq("shopify_variant_id", String(variant.id))
          .single();

        if (existing) {
          const { error } = await supabase
            .from("products")
            .update(productData)
            .eq("id", existing.id);
          
          if (error) {
            errors.push(`Failed to update ${product.title}: ${error.message}`);
          } else {
            updated++;
          }
        } else {
          const { error } = await supabase
            .from("products")
            .insert(productData);
          
          if (error) {
            errors.push(`Failed to create ${product.title}: ${error.message}`);
          } else {
            created++;
          }
        }
      }
    }

    // Update sync history
    if (historyId) {
      await updateSyncHistoryEntry(supabase, historyId, {
        status: "completed",
        products_created: created,
        products_updated: updated,
        error_message: errors.length > 0 ? errors.slice(0, 5).join("; ") : undefined,
      });
    }

    console.log(`[PRODUCT-SYNC] Sync complete: ${created} created, ${updated} updated, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        created,
        updated,
        total: products.length,
        errors: errors.slice(0, 10), // Limit errors returned
      }),
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
