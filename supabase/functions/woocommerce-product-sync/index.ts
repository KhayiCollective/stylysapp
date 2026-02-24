import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface WooVariation {
  id: number;
  price: string;
  stock_status: string;
  attributes: { name: string; option: string }[];
}

interface WooProduct {
  id: number;
  name: string;
  slug: string;
  price: string;
  type: string;
  categories: { id: number; name: string; slug: string }[];
  tags: { id: number; name: string; slug: string }[];
  images: { id: number; src: string; alt: string }[];
  stock_status: string;
  attributes: { name: string; options: string[]; variation: boolean }[];
  variations: number[];
}

const COLOR_ATTR_NAMES = ["color", "colour", "colors", "colours"];
const SIZE_ATTR_NAMES = ["size", "sizes"];

async function fetchAllWooProducts(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string
): Promise<WooProduct[]> {
  const allProducts: WooProduct[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = `${storeUrl.replace(/\/$/, "")}/wp-json/wc/v3/products?per_page=${perPage}&page=${page}`;
    console.log(`[WOO-SYNC] Fetching page ${page}...`);

    const response = await fetch(url, {
      headers: {
        Authorization: "Basic " + btoa(`${consumerKey}:${consumerSecret}`),
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`WooCommerce API error ${response.status}: ${text}`);
    }

    const products: WooProduct[] = await response.json();
    allProducts.push(...products);

    if (products.length < perPage) break;
    page++;
  }

  return allProducts;
}

async function fetchVariations(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string,
  productId: number
): Promise<WooVariation[]> {
  const url = `${storeUrl.replace(/\/$/, "")}/wp-json/wc/v3/products/${productId}/variations?per_page=100`;
  const response = await fetch(url, {
    headers: {
      Authorization: "Basic " + btoa(`${consumerKey}:${consumerSecret}`),
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) return [];
  return await response.json();
}

interface ColorGroup {
  color: string | null;
  variants: { variant_id: string; size: string; price: string; available: boolean }[];
  price: number;
  imageUrl: string | null;
}

function groupWooVariationsByColor(
  product: WooProduct,
  variations: WooVariation[]
): ColorGroup[] {
  const colorAttr = product.attributes.find((a) =>
    COLOR_ATTR_NAMES.includes(a.name.toLowerCase())
  );
  const sizeAttr = product.attributes.find((a) =>
    SIZE_ATTR_NAMES.includes(a.name.toLowerCase())
  );

  // Simple product or no color attribute → single group
  if (!colorAttr || variations.length === 0) {
    return [{
      color: null,
      variants: [],
      price: parseFloat(product.price) || 0,
      imageUrl: product.images?.[0]?.src || null,
    }];
  }

  const groups: Record<string, ColorGroup> = {};

  for (const variation of variations) {
    const colorValue = variation.attributes.find(
      (a) => COLOR_ATTR_NAMES.includes(a.name.toLowerCase())
    )?.option || "Default";

    const sizeValue = variation.attributes.find(
      (a) => SIZE_ATTR_NAMES.includes(a.name.toLowerCase())
    )?.option || "";

    if (!groups[colorValue]) {
      groups[colorValue] = {
        color: colorValue,
        variants: [],
        price: parseFloat(variation.price) || parseFloat(product.price) || 0,
        imageUrl: product.images?.[0]?.src || null,
      };
    }

    groups[colorValue].variants.push({
      variant_id: String(variation.id),
      size: sizeValue,
      price: variation.price,
      available: variation.stock_status === "instock",
    });
  }

  return Object.values(groups);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brand_id, action, store_url, consumer_key, consumer_secret } = await req.json();

    if (!brand_id) {
      return new Response(
        JSON.stringify({ error: "brand_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("woocommerce_store_url, woocommerce_consumer_key, woocommerce_consumer_secret")
      .eq("id", brand_id)
      .single();

    if (brandError || !brand) {
      return new Response(
        JSON.stringify({ error: "Brand not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (store_url && consumer_key && consumer_secret) {
      const { error: updateError } = await supabase
        .from("brands")
        .update({
          woocommerce_store_url: store_url,
          woocommerce_consumer_key: consumer_key,
          woocommerce_consumer_secret: consumer_secret,
          woocommerce_connected_at: new Date().toISOString(),
        })
        .eq("id", brand_id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to save WooCommerce credentials" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      brand.woocommerce_store_url = store_url;
      brand.woocommerce_consumer_key = consumer_key;
      brand.woocommerce_consumer_secret = consumer_secret;
    }

    const wooUrl = brand.woocommerce_store_url;
    const wooKey = brand.woocommerce_consumer_key;
    const wooSecret = brand.woocommerce_consumer_secret;

    if (!wooUrl || !wooKey || !wooSecret) {
      return new Response(
        JSON.stringify({ error: "WooCommerce not connected for this brand" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "status") {
      const { count: productCount } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("brand_id", brand_id)
        .eq("source", "woocommerce");

      return new Response(
        JSON.stringify({ syncedProducts: productCount || 0, storeUrl: wooUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: historyData } = await supabase
      .from("sync_history")
      .insert({ brand_id, sync_type: "woocommerce", status: "in_progress" })
      .select("id")
      .single();

    const historyId = historyData?.id;

    let products: WooProduct[];
    try {
      products = await fetchAllWooProducts(wooUrl, wooKey, wooSecret);
    } catch (fetchError) {
      if (historyId) {
        await supabase
          .from("sync_history")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: fetchError instanceof Error ? fetchError.message : String(fetchError),
          })
          .eq("id", historyId);
      }
      throw fetchError;
    }

    console.log(`[WOO-SYNC] Got ${products.length} products`);

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    const stockMap: Record<string, string> = {
      instock: "in_stock",
      outofstock: "out_of_stock",
      onbackorder: "low_stock",
    };

    for (const product of products) {
      // Fetch variations for variable products
      let variations: WooVariation[] = [];
      if (product.type === "variable" && product.variations?.length > 0) {
        variations = await fetchVariations(wooUrl, wooKey, wooSecret, product.id);
      }

      const colorGroups = groupWooVariationsByColor(product, variations);

      for (const group of colorGroups) {
        const name = group.color && group.color !== "Default"
          ? `${product.name} - ${group.color}`
          : product.name;

        const productData = {
          brand_id,
          name,
          category: product.categories?.[0]?.name?.toLowerCase() || "uncategorized",
          price: group.price,
          image_url: group.imageUrl,
          color: group.color?.toLowerCase() || null,
          inventory_status: stockMap[product.stock_status] || "in_stock",
          tags: product.tags?.map((t) => t.name) || [],
          source: "woocommerce",
          woocommerce_product_id: group.color
            ? `${product.id}_${group.color}`
            : String(product.id),
          variants_json: group.variants,
        };

        const lookupId = productData.woocommerce_product_id;

        const { data: existing } = await supabase
          .from("products")
          .select("id")
          .eq("brand_id", brand_id)
          .eq("woocommerce_product_id", lookupId)
          .single();

        if (existing) {
          const { error } = await supabase.from("products").update(productData).eq("id", existing.id);
          if (error) errors.push(`Update ${name}: ${error.message}`);
          else updated++;
        } else {
          const { error } = await supabase.from("products").insert(productData);
          if (error) errors.push(`Create ${name}: ${error.message}`);
          else created++;
        }
      }
    }

    if (historyId) {
      await supabase
        .from("sync_history")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          products_created: created,
          products_updated: updated,
          error_message: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
        })
        .eq("id", historyId);
    }

    return new Response(
      JSON.stringify({ success: true, created, updated, total: products.length, errors: errors.slice(0, 10) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[WOO-SYNC] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
