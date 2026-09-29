import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// Generates a small JS payload that renders a "Complete the Look" section
// directly inline on a Shopify product page — outfits built around the
// current product, shown right in the page layout (not inside a floating
// panel/iframe like the STYLYS widget embed). This is the feature the
// merchant remembered from the original Lovable build (src/pages/ProductDetail.tsx
// + src/components/shop/RecommendedOutfits.tsx, which only ever existed in
// the app's own in-app demo storefront) — this function is the real,
// live-Shopify-theme version of that same idea.
//
// Loaded via a theme app extension BLOCK (not the body-target app EMBED used
// by widget-loader) — see extensions/stylys-widget/blocks/complete_the_look.liquid.
// A block renders inline wherever the merchant places it in the product
// template via the theme editor, which is exactly what's needed here: this
// content lives in the page's normal flow, not a global overlay.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

async function resolveBrandIdByShop(shop: string): Promise<string | null> {
  if (!shop) return null;
  const shopDomain = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase
    .from("brands")
    .select("id")
    .eq("shopify_store_domain", shopDomain)
    .maybeSingle();
  if (error || !data) return null;
  return data.id as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const shopParam = url.searchParams.get("shop") || "";
  const productIdParam = url.searchParams.get("product_id") || "";
  const productTitleParam = url.searchParams.get("product_title") || "";

  let brandId = "";
  if (shopParam) {
    const resolved = await resolveBrandIdByShop(shopParam);
    if (resolved) brandId = resolved;
  }

  const js = `
(function() {
  var CONTAINER_ID = 'stylys-complete-the-look';
  var brandId = ${JSON.stringify(brandId)};
  var shopDomain = ${JSON.stringify(shopParam)};
  var productId = ${JSON.stringify(productIdParam)};
  var productTitle = ${JSON.stringify(productTitleParam)};

  // Fallback product detection via Shopify's own JS globals, same pattern as
  // widget-loader.js — the liquid block already passes product.id directly
  // since this only ever renders on a product template, but this stays as a
  // safety net in case that ever comes back empty.
  if (!productId) {
    try {
      if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta &&
          window.ShopifyAnalytics.meta.page && window.ShopifyAnalytics.meta.page.resourceType === 'product' &&
          window.ShopifyAnalytics.meta.product && window.ShopifyAnalytics.meta.product.id) {
        productId = String(window.ShopifyAnalytics.meta.product.id);
      } else if (window.meta && window.meta.product && window.meta.product.id) {
        productId = String(window.meta.product.id);
      }
    } catch (e) {}
  }
  if (!shopDomain && window.Shopify && window.Shopify.shop) {
    shopDomain = window.Shopify.shop;
  }

  function findContainer(attemptsLeft) {
    var el = document.getElementById(CONTAINER_ID);
    if (el) { init(el); return; }
    if (attemptsLeft > 0) setTimeout(function() { findContainer(attemptsLeft - 1); }, 300);
  }

  function el(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  function money(n) {
    var num = Number(n) || 0;
    return '$' + num.toFixed(2);
  }

  // Same fan-out add-to-cart pattern as widget-loader.js, but calls
  // /cart/add.js directly — this renders in the page itself (not an iframe),
  // so there's no postMessage bridge needed.
  function addAllToCart(items, button) {
    var originalText = button.textContent;
    button.textContent = 'Adding...';
    button.disabled = true;
    var added = [];
    var failed = [];
    var chain = Promise.resolve();
    items.forEach(function(it) {
      if (!it.variantId) return;
      chain = chain.then(function() {
        return fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ id: it.variantId, quantity: 1 }),
        })
          .then(function(r) { return r.json().then(function(b) { return { ok: r.ok, body: b }; }); })
          .then(function(res) {
            if (res.ok) added.push(it.name);
            else failed.push(it.name);
          })
          .catch(function() { failed.push(it.name); });
      });
    });
    chain.then(function() {
      button.disabled = false;
      if (added.length === 0) {
        button.textContent = 'Sold out';
        setTimeout(function() { button.textContent = originalText; }, 2500);
        return;
      }
      button.textContent = failed.length ? added.length + ' added' : 'Added!';
      try {
        var evts = ['cart:refresh', 'cart:updated', 'cart:build', 'cart:change', 'cart-updated', 'ajaxProduct:added'];
        evts.forEach(function(n) {
          try { document.dispatchEvent(new CustomEvent(n, { bubbles: true })); } catch (_) {}
          try { window.dispatchEvent(new CustomEvent(n)); } catch (_) {}
        });
        if (typeof window.PUB_SUB_EVENTS !== 'undefined' && window.publish) {
          try { window.publish('cart-update', { source: 'stylys' }); } catch (_) {}
        }
        fetch('/?sections=cart-icon-bubble,cart-drawer,cart-notification', { credentials: 'same-origin' })
          .then(function(r) { return r.ok ? r.json() : null; })
          .then(function(sections) {
            if (!sections) return;
            Object.keys(sections).forEach(function(key) {
              var html = sections[key];
              if (!html) return;
              ['#shopify-section-' + key, '#' + key, '[data-section-id="' + key + '"]'].forEach(function(sel) {
                var target = document.querySelector(sel);
                if (target) { try { target.innerHTML = html; } catch (_) {} }
              });
            });
          })
          .catch(function() {});
      } catch (_) {}
      setTimeout(function() { button.textContent = originalText; }, 3000);
    });
  }

  function renderOutfitCard(outfit) {
    var card = el('div', 'stylys-ctl-card');

    var header = el('div', 'stylys-ctl-card-header');
    header.appendChild(el('h3', 'stylys-ctl-card-name', outfit.name || 'Look'));
    if (outfit.occasion) header.appendChild(el('p', 'stylys-ctl-card-occasion', 'Perfect for: ' + outfit.occasion));
    card.appendChild(header);

    var thumbs = el('div', 'stylys-ctl-thumbs');
    (outfit.items || []).slice(0, 5).forEach(function(item) {
      var thumb = el('div', 'stylys-ctl-thumb');
      var img = document.createElement('img');
      img.src = item.image_url || '';
      img.alt = item.name || '';
      img.loading = 'lazy';
      thumb.appendChild(img);
      if (item.available === false || item.in_stock === false) {
        thumb.appendChild(el('span', 'stylys-ctl-soldout', 'Sold Out'));
      }
      thumbs.appendChild(thumb);
    });
    card.appendChild(thumbs);

    if (outfit.reason) {
      var reasonText = outfit.reason.length > 140 ? outfit.reason.slice(0, 140) + '...' : outfit.reason;
      card.appendChild(el('p', 'stylys-ctl-reason', reasonText));
    }

    var footer = el('div', 'stylys-ctl-card-footer');
    var total = (outfit.items || []).reduce(function(s, i) { return s + (Number(i.price) || 0); }, 0);
    footer.appendChild(el('span', 'stylys-ctl-price', money(total)));

    var btnGroup = el('div', 'stylys-ctl-btn-group');

    // Hands this outfit off to the floating STYLYS panel's Try-On tab via the
    // __stylysTryOnOutfit bridge (see widget-loader.js) — that panel lives in
    // its own iframe so it can't be reached directly from here.
    if (window.__stylysTryOnOutfit) {
      var tryOnBtn = el('button', 'stylys-ctl-tryon-btn', 'Try On');
      tryOnBtn.type = 'button';
      tryOnBtn.onclick = function() {
        var items = (outfit.items || []).map(function(i) {
          return {
            id: i.id,
            name: i.name,
            imageUrl: i.image_url || i.imageUrl || '',
            category: i.category,
            shopify_variant_id: i.shopify_variant_id,
            price: i.price,
          };
        });
        window.__stylysTryOnOutfit(items);
      };
      btnGroup.appendChild(tryOnBtn);
    }

    var addBtn = el('button', 'stylys-ctl-add-btn', 'Add All');
    addBtn.type = 'button';
    addBtn.onclick = function() {
      var items = (outfit.items || [])
        .filter(function(i) { return i.available !== false && i.in_stock !== false; })
        .map(function(i) { return { variantId: i.shopify_variant_id, name: i.name }; })
        .filter(function(i) { return !!i.variantId; });
      if (!items.length) return;
      addAllToCart(items, addBtn);
    };
    btnGroup.appendChild(addBtn);
    footer.appendChild(btnGroup);
    card.appendChild(footer);

    return card;
  }

  function injectStyles() {
    if (document.getElementById('stylys-ctl-styles')) return;
    var style = document.createElement('style');
    style.id = 'stylys-ctl-styles';
    style.textContent =
      '.stylys-complete-the-look{margin-top:32px;padding-top:24px;border-top:1px solid rgba(0,0,0,0.1);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}' +
      '.stylys-ctl-heading{display:flex;align-items:center;gap:8px;font-size:20px;font-weight:600;margin-bottom:16px;}' +
      // Always exactly 3 equal columns in a single row on desktop — cards
      // shrink to fit rather than wrapping to a second row. Falls back to a
      // single column below 700px so cards don't get squished unreadably
      // narrow on phones.
      '.stylys-ctl-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}' +
      '@media (max-width:700px){.stylys-ctl-grid{grid-template-columns:1fr;}}' +
      '.stylys-ctl-card{border:1px solid rgba(0,0,0,0.1);border-radius:10px;padding:14px;background:#fff;display:flex;flex-direction:column;gap:10px;}' +
      '.stylys-ctl-card-name{font-size:14px;font-weight:600;margin:0;}' +
      '.stylys-ctl-card-occasion{font-size:12px;color:#666;margin:2px 0 0;}' +
      '.stylys-ctl-thumbs{display:flex;gap:6px;}' +
      '.stylys-ctl-thumb{flex:1;aspect-ratio:1/1;border-radius:6px;overflow:hidden;background:#f2f2f2;position:relative;}' +
      '.stylys-ctl-thumb img{width:100%;height:100%;object-fit:cover;display:block;}' +
      '.stylys-ctl-soldout{position:absolute;top:4px;left:4px;background:#c0392b;color:#fff;font-size:9px;font-weight:600;padding:2px 5px;border-radius:4px;}' +
      '.stylys-ctl-reason{font-size:12px;color:#555;line-height:1.4;margin:0;}' +
      '.stylys-ctl-card-footer{display:flex;align-items:center;justify-content:space-between;margin-top:auto;padding-top:8px;}' +
      '.stylys-ctl-price{font-size:14px;font-weight:600;}' +
      '.stylys-ctl-btn-group{display:flex;gap:8px;}' +
      '.stylys-ctl-add-btn{background:#000;color:#fff;border:none;border-radius:20px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;transition:opacity 0.15s;}' +
      '.stylys-ctl-add-btn:hover{opacity:0.85;}' +
      '.stylys-ctl-add-btn:disabled{opacity:0.6;cursor:default;}' +
      '.stylys-ctl-tryon-btn{background:#fff;color:#000;border:1px solid #000;border-radius:20px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;transition:opacity 0.15s;}' +
      '.stylys-ctl-tryon-btn:hover{opacity:0.7;}' +
      '.stylys-ctl-loading,.stylys-ctl-empty{font-size:13px;color:#777;padding:20px 0;}';
    document.head.appendChild(style);
  }

  function init(container) {
    if (!productId) return;
    injectStyles();
    container.innerHTML = '';
    var heading = el('div', 'stylys-ctl-heading', '✨ Complete the Look');
    container.appendChild(heading);
    var loading = el('div', 'stylys-ctl-loading', 'Curating outfits for you...');
    container.appendChild(loading);

    var body = { anchor_product_id: productId };
    if (brandId) body.brand_id = brandId;
    if (shopDomain) body.shop = shopDomain;

    fetch('${SUPABASE_URL}/functions/v1/widget-outfits/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        container.innerHTML = '';
        container.appendChild(heading);
        var outfits = (data && data.outfits) || [];
        if (!outfits.length) {
          container.appendChild(el('div', 'stylys-ctl-empty', 'No outfit recommendations available right now.'));
          return;
        }
        var grid = el('div', 'stylys-ctl-grid');
        outfits.forEach(function(outfit) { grid.appendChild(renderOutfitCard(outfit)); });
        container.appendChild(grid);
      })
      .catch(function() {
        container.innerHTML = '';
        container.appendChild(heading);
        container.appendChild(el('div', 'stylys-ctl-empty', 'No outfit recommendations available right now.'));
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { findContainer(6); });
  } else {
    findContainer(6);
  }
})();
`;

  return new Response(js, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=300",
    },
  });
});
