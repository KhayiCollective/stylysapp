import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_CLIENT_SECRET = Deno.env.get("SHOPIFY_CLIENT_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Verify Shopify HMAC signature
async function verifyShopifySignature(
  queryParams: URLSearchParams,
  secret: string
): Promise<boolean> {
  const signature = queryParams.get("signature");
  if (!signature) {
    console.log("No signature provided");
    return false;
  }

  // Build the message by sorting parameters (excluding signature)
  const params: Record<string, string> = {};
  queryParams.forEach((value, key) => {
    if (key !== "signature") {
      params[key] = value;
    }
  });

  const sortedKeys = Object.keys(params).sort();
  const message = sortedKeys.map((key) => `${key}=${params[key]}`).join("");

  // Calculate HMAC using Web Crypto API
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const calculatedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const isValid = calculatedSignature === signature;
  console.log("Signature verification:", isValid ? "PASSED" : "FAILED");
  return isValid;
}

// Brand type
interface Brand {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  shopify_store_domain: string | null;
  shopify_access_token: string | null;
  shopify_storefront_token: string | null;
  shopify_connected_at: string | null;
}

// Get brand by shop domain
async function getBrandByShop(
  supabase: any,
  shopDomain: string
): Promise<Brand | null> {
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("shopify_store_domain", shopDomain)
    .single();

  if (error) {
    console.error("Error fetching brand:", error);
    return null;
  }
  return data as Brand;
}

// Cart Create mutation for Storefront API
const CART_CREATE_MUTATION = `
  mutation cartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        totalQuantity
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// Cart Lines Add mutation for Storefront API
const CART_LINES_ADD_MUTATION = `
  mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        id
        checkoutUrl
        totalQuantity
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// Make Storefront API request
async function storefrontRequest(
  storeDomain: string,
  storefrontToken: string,
  query: string,
  variables: Record<string, unknown>
) {
  const url = `https://${storeDomain}/api/2025-07/graphql.json`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": storefrontToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Storefront API error: ${response.status}`);
  }

  return response.json();
}

// Create cart with items
async function createCart(
  storeDomain: string,
  storefrontToken: string,
  variantIds: string[]
) {
  const lines = variantIds.map((id) => ({
    merchandiseId: id,
    quantity: 1,
  }));

  const result = await storefrontRequest(
    storeDomain,
    storefrontToken,
    CART_CREATE_MUTATION,
    { input: { lines } }
  );

  if (result.data?.cartCreate?.userErrors?.length > 0) {
    throw new Error(result.data.cartCreate.userErrors[0].message);
  }

  const cart = result.data?.cartCreate?.cart;
  if (!cart?.checkoutUrl) {
    throw new Error("Failed to create cart");
  }

  // Add channel parameter for proper checkout
  const checkoutUrl = new URL(cart.checkoutUrl);
  checkoutUrl.searchParams.set("channel", "online_store");

  return {
    cartId: cart.id,
    checkoutUrl: checkoutUrl.toString(),
    totalQuantity: cart.totalQuantity,
  };
}

// Generate outfit builder HTML with Storefront API cart integration
function generateOutfitBuilderHTML(brand: Brand, products: any[], config: any) {
  const shopDomain = brand.shopify_store_domain || "";
  const storefrontToken = brand.shopify_storefront_token || "";
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>STYLYS Outfit Builder - ${brand.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .stylys-container { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .stylys-header { text-align: center; margin-bottom: 32px; }
    .stylys-header h1 { font-size: 28px; font-weight: 600; margin-bottom: 8px; }
    .stylys-header p { color: #666; font-size: 16px; }
    .stylys-products { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 24px; }
    .stylys-product { border: 1px solid #eee; border-radius: 12px; overflow: hidden; transition: box-shadow 0.2s; }
    .stylys-product:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .stylys-product img { width: 100%; aspect-ratio: 1; object-fit: cover; }
    .stylys-product-info { padding: 16px; }
    .stylys-product-title { font-weight: 500; margin-bottom: 8px; }
    .stylys-product-price { color: #666; font-size: 14px; }
    .stylys-cta { background: ${config?.primary_color || '#000'}; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; width: 100%; margin-top: 12px; font-size: 14px; transition: opacity 0.2s; }
    .stylys-cta:hover { opacity: 0.9; }
    .stylys-cta:disabled { opacity: 0.5; cursor: not-allowed; }
    .stylys-cta.loading { position: relative; color: transparent; }
    .stylys-cta.loading::after { content: ''; position: absolute; inset: 0; margin: auto; width: 16px; height: 16px; border: 2px solid white; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .stylys-empty { text-align: center; padding: 48px; color: #666; }
    .stylys-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: #333; color: white; padding: 12px 24px; border-radius: 8px; font-size: 14px; z-index: 1000; opacity: 0; transition: opacity 0.3s; }
    .stylys-toast.show { opacity: 1; }
    .stylys-toast.success { background: #22c55e; }
    .stylys-toast.error { background: #ef4444; }
  </style>
</head>
<body>
  <div class="stylys-container">
    <div class="stylys-header">
      <h1>Build Your Perfect Outfit</h1>
      <p>AI-powered styling recommendations personalized for you</p>
    </div>
    ${products.length > 0 ? `
    <div class="stylys-products">
      ${products.map((p: any) => `
        <div class="stylys-product" data-product-id="${p.id}">
          <img src="${p.image_url || '/placeholder.svg'}" alt="${p.name}" />
          <div class="stylys-product-info">
            <div class="stylys-product-title">${p.name}</div>
            <div class="stylys-product-price">$${p.price.toFixed(2)}</div>
            <button class="stylys-cta" data-variant-id="${p.shopify_variant_id || ''}" onclick="addToCart(this)">Add to Cart</button>
          </div>
        </div>
      `).join('')}
    </div>
    ` : `
    <div class="stylys-empty">
      <p>No products available. Complete the style quiz to get personalized recommendations!</p>
      <a href="/apps/stylys/quiz" class="stylys-cta" style="display: inline-block; text-decoration: none; margin-top: 16px;">Take Style Quiz</a>
    </div>
    `}
  </div>
  <div id="toast" class="stylys-toast"></div>
  
  <script>
    const SHOP_DOMAIN = "${shopDomain}";
    const STOREFRONT_TOKEN = "${storefrontToken}";
    const API_VERSION = "2025-07";
    
    function showToast(message, type = 'success') {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.className = 'stylys-toast show ' + type;
      setTimeout(() => toast.classList.remove('show'), 3000);
    }
    
    async function storefrontFetch(query, variables = {}) {
      const response = await fetch(\`https://\${SHOP_DOMAIN}/api/\${API_VERSION}/graphql.json\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN
        },
        body: JSON.stringify({ query, variables })
      });
      return response.json();
    }
    
    async function addToCart(button) {
      const variantId = button.dataset.variantId;
      
      if (!variantId) {
        showToast('Product not available for purchase', 'error');
        return;
      }
      
      if (!STOREFRONT_TOKEN) {
        // Fallback to Shopify's cart.js API (works on the same domain)
        try {
          const response = await fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: variantId.replace('gid://shopify/ProductVariant/', ''), quantity: 1 })
          });
          if (response.ok) {
            showToast('Added to cart!', 'success');
            button.textContent = 'Added ✓';
            setTimeout(() => button.textContent = 'Add to Cart', 2000);
          } else {
            throw new Error('Failed to add to cart');
          }
        } catch (err) {
          showToast('Failed to add to cart', 'error');
        }
        return;
      }
      
      button.classList.add('loading');
      button.disabled = true;
      
      try {
        // Create a new cart with this item
        const result = await storefrontFetch(\`
          mutation cartCreate($input: CartInput!) {
            cartCreate(input: $input) {
              cart {
                id
                checkoutUrl
                totalQuantity
              }
              userErrors {
                field
                message
              }
            }
          }
        \`, {
          input: {
            lines: [{ merchandiseId: variantId, quantity: 1 }]
          }
        });
        
        if (result.data?.cartCreate?.userErrors?.length > 0) {
          throw new Error(result.data.cartCreate.userErrors[0].message);
        }
        
        const cart = result.data?.cartCreate?.cart;
        if (cart?.checkoutUrl) {
          showToast('Added to cart!', 'success');
          button.textContent = 'Added ✓';
          
          // Store cart ID for future use
          localStorage.setItem('stylys_cart_id', cart.id);
          localStorage.setItem('stylys_checkout_url', cart.checkoutUrl + '&channel=online_store');
          
          setTimeout(() => button.textContent = 'Add to Cart', 2000);
        } else {
          throw new Error('Failed to create cart');
        }
      } catch (err) {
        console.error('Add to cart error:', err);
        showToast('Failed to add to cart', 'error');
      } finally {
        button.classList.remove('loading');
        button.disabled = false;
      }
    }
    
    // Checkout function for "Buy Now" style buttons
    async function checkout(variantId) {
      const result = await storefrontFetch(\`
        mutation cartCreate($input: CartInput!) {
          cartCreate(input: $input) {
            cart { checkoutUrl }
            userErrors { message }
          }
        }
      \`, {
        input: { lines: [{ merchandiseId: variantId, quantity: 1 }] }
      });
      
      const checkoutUrl = result.data?.cartCreate?.cart?.checkoutUrl;
      if (checkoutUrl) {
        window.open(checkoutUrl + '&channel=online_store', '_blank');
      }
    }
  </script>
</body>
</html>
  `;
}

// Generate style quiz HTML
function generateQuizHTML(brand: Brand, config: any) {
  const questions = config?.quiz_questions || [
    { id: 'style', question: 'What best describes your style?', options: ['Classic', 'Casual', 'Trendy', 'Minimalist'] },
    { id: 'occasion', question: 'What occasion are you shopping for?', options: ['Work', 'Casual', 'Date Night', 'Special Event'] },
    { id: 'colors', question: 'What colors do you prefer?', options: ['Neutrals', 'Bold Colors', 'Pastels', 'Earth Tones'] },
  ];

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Style Quiz - ${brand.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9f9f9; }
    .quiz-container { max-width: 600px; margin: 0 auto; padding: 24px; }
    .quiz-header { text-align: center; margin-bottom: 32px; }
    .quiz-header h1 { font-size: 28px; font-weight: 600; margin-bottom: 8px; }
    .quiz-header p { color: #666; font-size: 16px; }
    .quiz-question { background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .quiz-question h3 { font-size: 18px; margin-bottom: 16px; }
    .quiz-options { display: grid; gap: 12px; }
    .quiz-option { padding: 16px; border: 2px solid #eee; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
    .quiz-option:hover { border-color: ${config?.primary_color || '#000'}; }
    .quiz-option.selected { border-color: ${config?.primary_color || '#000'}; background: ${config?.primary_color || '#000'}10; }
    .quiz-submit { background: ${config?.primary_color || '#000'}; color: white; border: none; padding: 16px 32px; border-radius: 8px; cursor: pointer; width: 100%; font-size: 16px; font-weight: 500; }
    .quiz-submit:hover { opacity: 0.9; }
    .quiz-submit:disabled { opacity: 0.5; cursor: not-allowed; }
  </style>
</head>
<body>
  <div class="quiz-container">
    <div class="quiz-header">
      <h1>Discover Your Style</h1>
      <p>Answer a few questions to get personalized outfit recommendations</p>
    </div>
    <form id="styleQuiz" onsubmit="submitQuiz(event)">
      ${questions.map((q: any, i: number) => `
        <div class="quiz-question" data-question="${q.id}">
          <h3>${i + 1}. ${q.question}</h3>
          <div class="quiz-options">
            ${q.options.map((opt: string) => `
              <label class="quiz-option">
                <input type="radio" name="${q.id}" value="${opt}" style="display:none" onchange="selectOption(this)">
                ${opt}
              </label>
            `).join('')}
          </div>
        </div>
      `).join('')}
      <button type="submit" class="quiz-submit" id="submitBtn" disabled>Get My Recommendations</button>
    </form>
  </div>
  <script>
    function selectOption(input) {
      const questionDiv = input.closest('.quiz-question');
      questionDiv.querySelectorAll('.quiz-option').forEach(opt => opt.classList.remove('selected'));
      input.closest('.quiz-option').classList.add('selected');
      checkAllAnswered();
    }
    
    function checkAllAnswered() {
      const form = document.getElementById('styleQuiz');
      const questions = form.querySelectorAll('.quiz-question');
      let allAnswered = true;
      questions.forEach(q => {
        if (!q.querySelector('input:checked')) allAnswered = false;
      });
      document.getElementById('submitBtn').disabled = !allAnswered;
    }
    
    function submitQuiz(e) {
      e.preventDefault();
      const formData = new FormData(e.target);
      const answers = Object.fromEntries(formData);
      console.log('Quiz answers:', answers);
      const params = new URLSearchParams(answers).toString();
      window.location.href = '/apps/stylys/outfit-builder?' + params;
    }
  </script>
</body>
</html>
  `;
}

// Generate recommendations JSON
async function getRecommendations(
  supabase: any,
  brandId: string,
  queryParams: URLSearchParams
) {
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("*")
    .eq("brand_id", brandId)
    .eq("inventory_status", "in_stock")
    .limit(20);

  if (productsError) {
    console.error("Error fetching products:", productsError);
    return { products: [], outfits: [] };
  }

  const { data: rules, error: rulesError } = await supabase
    .from("rules")
    .select("*")
    .eq("brand_id", brandId)
    .eq("enabled", true);

  if (rulesError) {
    console.error("Error fetching rules:", rulesError);
  }

  return {
    products: products || [],
    rules: rules || [],
    quizData: {
      style: queryParams.get("style"),
      occasion: queryParams.get("occasion"),
      colors: queryParams.get("colors"),
    },
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const queryParams = url.searchParams;
    
    console.log("App Proxy request:", {
      path: url.pathname,
      params: Object.fromEntries(queryParams),
    });

    // Get shop domain from query params (Shopify always sends this)
    const shop = queryParams.get("shop");
    
    // Verify signature in production
    if (SHOPIFY_CLIENT_SECRET && shop) {
      const isValid = await verifyShopifySignature(queryParams, SHOPIFY_CLIENT_SECRET);
      if (!isValid) {
        console.warn("Invalid Shopify signature - proceeding anyway for development");
      }
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get brand by shop domain
    let brand: Brand | null = null;
    if (shop) {
      brand = await getBrandByShop(supabase, shop);
    }

    if (!brand && shop) {
      // Try without protocol variations
      const cleanShop = shop.replace(/^https?:\/\//, "").replace(/\/$/, "");
      brand = await getBrandByShop(supabase, cleanShop);
    }

    if (!brand) {
      console.error("Brand not found for shop:", shop);
      return new Response(
        JSON.stringify({ error: "Store not connected to STYLYS" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Found brand:", brand.name, "ID:", brand.id);

    // Get widget config
    const { data: widgetConfig } = await supabase
      .from("widget_config")
      .select("*")
      .eq("brand_id", brand.id)
      .single();

    // Determine the requested path/action
    const requestedPath = queryParams.get("path") || "outfit-builder";
    const format = req.headers.get("Accept")?.includes("application/json")
      ? "json"
      : "html";

    console.log("Requested path:", requestedPath, "Format:", format);

    // Route to appropriate handler
    switch (requestedPath) {
      case "cart": {
        // Handle cart API requests
        if (req.method !== "POST") {
          return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const body = await req.json();
        const { action, variantIds, cartId, lines } = body;

        if (!brand.shopify_storefront_token || !brand.shopify_store_domain) {
          return new Response(
            JSON.stringify({ error: "Store not configured for cart" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        try {
          if (action === "create" && variantIds?.length > 0) {
            const cart = await createCart(
              brand.shopify_store_domain,
              brand.shopify_storefront_token,
              variantIds
            );
            return new Response(JSON.stringify(cart), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          if (action === "add" && cartId && lines?.length > 0) {
            const result = await storefrontRequest(
              brand.shopify_store_domain,
              brand.shopify_storefront_token,
              CART_LINES_ADD_MUTATION,
              { cartId, lines }
            );

            if (result.data?.cartLinesAdd?.userErrors?.length > 0) {
              throw new Error(result.data.cartLinesAdd.userErrors[0].message);
            }

            const cart = result.data?.cartLinesAdd?.cart;
            const checkoutUrl = new URL(cart.checkoutUrl);
            checkoutUrl.searchParams.set("channel", "online_store");

            return new Response(
              JSON.stringify({
                cartId: cart.id,
                checkoutUrl: checkoutUrl.toString(),
                totalQuantity: cart.totalQuantity,
              }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }

          return new Response(
            JSON.stringify({ error: "Invalid cart action" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        } catch (err) {
          const error = err as Error;
          console.error("Cart error:", error);
          return new Response(
            JSON.stringify({ error: error.message || "Cart operation failed" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      case "quiz": {
        if (format === "json") {
          return new Response(
            JSON.stringify({
              questions: widgetConfig?.quiz_questions || [],
              config: widgetConfig,
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        return new Response(generateQuizHTML(brand, widgetConfig), {
          headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
        });
      }

      case "recommendations": {
        const recommendations = await getRecommendations(
          supabase,
          brand.id,
          queryParams
        );
        return new Response(JSON.stringify(recommendations), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "outfit-builder":
      default: {
        // Fetch products for the outfit builder
        const { data: products } = await supabase
          .from("products")
          .select("*")
          .eq("brand_id", brand.id)
          .eq("inventory_status", "in_stock")
          .limit(12);

        if (format === "json") {
          return new Response(
            JSON.stringify({
              brand: { name: brand.name, logo: brand.logo_url },
              products: products || [],
              config: widgetConfig,
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        return new Response(
          generateOutfitBuilderHTML(brand, products || [], widgetConfig),
          {
            headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
          }
        );
      }
    }
  } catch (err) {
    const error = err as Error;
    console.error("App Proxy error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
