import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const appUrl = "https://stylysapp.com";

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

  // Always resolve brand_id from shop domain when shopParam is present — never trust
  // the URL brand_id param, which may be stale from a previous Supabase project.
  // Fall back to the URL param only when there is no shop to resolve from.
  let brandId = "";
  if (shopParam) {
    const resolved = await resolveBrandIdByShop(shopParam);
    if (resolved) brandId = resolved;
  } else {
    brandId = url.searchParams.get("brand_id") || "";
  }

  const widgetJs = `
(function() {
  if (window.__stylysWidget_agvobtjeizdoppzkvyyu) return;
  window.__stylysWidget_agvobtjeizdoppzkvyyu = true;

  // Resolve brand_id at load time. Priority:
  // 1. Injected by edge function (theme app embed passes ?shop=)
  // 2. Script tag query string ?brand_id= or ?shop=
  // 3. Shopify storefront global (window.Shopify.shop)
  var brandId = ${JSON.stringify(brandId)};
  var shopDomain = ${JSON.stringify(shopParam)};

  if (!brandId) {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || '';
      if (src.indexOf('widget-loader') !== -1) {
        var bMatch = src.match(/brand_id=([^&]+)/);
        if (bMatch) brandId = decodeURIComponent(bMatch[1]);
        var sMatch = src.match(/shop=([^&]+)/);
        if (sMatch && !shopDomain) shopDomain = decodeURIComponent(sMatch[1]);
      }
    }
  }

  if (!shopDomain && window.Shopify && window.Shopify.shop) {
    shopDomain = window.Shopify.shop;
  }

  // Create floating button
  var btn = document.createElement('div');
  btn.id = 'stylys-trigger';
  btn.setAttribute('aria-label', 'Open STYLYS personal stylist');
  btn.innerHTML = '<img src="https://stylysapp.com/S_no_border.png?v=3" alt="STYLYS" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" />';
  btn.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:999999;width:56px;height:56px;border-radius:50%;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,0.3);transition:transform 0.2s;';
  btn.onmouseenter = function() { btn.style.transform = 'scale(1.1)'; };
  btn.onmouseleave = function() { btn.style.transform = 'scale(1)'; };

  var overlay = document.createElement('div');
  overlay.id = 'stylys-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:999998;display:none;opacity:0;transition:opacity 0.3s;';

  var panel = document.createElement('div');
  panel.id = 'stylys-panel';
  panel.style.cssText = 'position:fixed;top:0;right:-420px;width:400px;max-width:90vw;height:100vh;z-index:1000000;background:#fff;box-shadow:-4px 0 30px rgba(0,0,0,0.2);transition:right 0.3s ease;';

  var iframe = document.createElement('iframe');
  var params = [];
  if (brandId) params.push('brand_id=' + encodeURIComponent(brandId));
  if (shopDomain) params.push('shop=' + encodeURIComponent(shopDomain));
  var qs = params.length ? '?' + params.join('&') : '';
  iframe.src = '${appUrl}/widget-preview' + qs;
  iframe.style.cssText = 'width:100%;height:100%;border:none;';
  iframe.allow = 'camera';
  panel.appendChild(iframe);

  var isOpen = false;
  function toggle() {
    isOpen = !isOpen;
    if (isOpen) {
      overlay.style.display = 'block';
      setTimeout(function() { overlay.style.opacity = '1'; }, 10);
      panel.style.right = '0';
      btn.style.display = 'none';
    } else {
      overlay.style.opacity = '0';
      panel.style.right = '-420px';
      btn.style.display = 'flex';
      setTimeout(function() { overlay.style.display = 'none'; }, 300);
    }
  }

  btn.onclick = toggle;
  overlay.onclick = toggle;

  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;
    if (e.data.type === 'stylys-close' && isOpen) toggle();
    if (e.data.type === 'stylys-open' && !isOpen) toggle();
    if (e.data.type === 'stylys-open-cart') {
      try { window.location.href = '/cart'; } catch (_) {}
      return;
    }
    if (e.data.type === 'stylys-add-to-cart') {
      var reqId = e.data.requestId;
      var rawItems = Array.isArray(e.data.items) ? e.data.items : [];
      var items = rawItems
        .map(function(it) {
          var raw = it && (it.id != null ? it.id : (it.variant_id != null ? it.variant_id : it.variantId));
          if (raw == null) return null;
          var s = String(raw).split('?')[0];
          var tail = s.indexOf('/') !== -1 ? s.slice(s.lastIndexOf('/') + 1) : s;
          var digits = tail.match(/\\d+/g);
          if (!digits || !digits.length) return null;
          var best = digits.reduce(function(a, b) { return b.length > a.length ? b : a; });
          if (!/^[1-9]\\d{0,19}$/.test(best)) return null;
          return { id: best, quantity: Math.max(1, parseInt(it.quantity, 10) || 1), name: (it && it.name) ? String(it.name) : '' };
        })
        .filter(Boolean);
      if (!items.length) {
        try { console.warn('[stylys] cart add: no valid variant IDs', rawItems); } catch (_) {}
        e.source && e.source.postMessage({ type: 'stylys-cart-result', requestId: reqId, ok: false, error: 'No valid variant IDs', added: [], failed: [] }, '*');
        return;
      }
      // Add each item one at a time so a single sold-out item does not block the rest.
      // Shopify's /cart/add.js bulk mode is all-or-nothing — it rejects the whole
      // request if ANY line is unavailable, so we deliberately fan out instead.
      var added = [];
      var failed = [];
      var chain = Promise.resolve();
      items.forEach(function(it) {
        chain = chain.then(function() {
          return fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ id: it.id, quantity: it.quantity })
          })
            .then(function(r) { return r.json().then(function(b) { return { ok: r.ok, body: b }; }); })
            .then(function(res) {
              if (res.ok) {
                added.push({ id: it.id, name: it.name });
              } else {
                var reason = (res.body && (res.body.description || res.body.message)) || 'Unavailable';
                failed.push({ id: it.id, name: it.name, reason: reason });
              }
            })
            .catch(function(err) {
              failed.push({ id: it.id, name: it.name, reason: String(err && err.message || err) });
            });
        });
      });
      chain.then(function() {
        if (added.length > 0) {
          // Fan out every refresh signal we know of — themes vary widely
          // (Dawn, Sense, Refresh, Liquid Ajax Cart, custom drawers, etc.).
          try {
            var evts = ['cart:refresh','cart:updated','cart:build','cart:change','cart-updated','ajaxProduct:added'];
            evts.forEach(function(n){
              try { document.dispatchEvent(new CustomEvent(n, { bubbles: true })); } catch(_) {}
              try { window.dispatchEvent(new CustomEvent(n)); } catch(_) {}
            });
            // PUB/SUB used by Dawn theme
            if (typeof window.PUB_SUB_EVENTS !== 'undefined' && window.publish) {
              try { window.publish('cart-update', { source: 'stylys' }); } catch(_) {}
            }
            // Refresh cart sections (Dawn / Section Rendering API) so the
            // header bubble + drawer re-render immediately.
            fetch('/?sections=cart-icon-bubble,cart-drawer,cart-notification', { credentials: 'same-origin' })
              .then(function(r){ return r.ok ? r.json() : null; })
              .then(function(sections){
                if (!sections) return;
                Object.keys(sections).forEach(function(key){
                  var html = sections[key];
                  if (!html) return;
                  var selectors = ['#shopify-section-' + key, '#' + key, '[data-section-id="' + key + '"]'];
                  selectors.forEach(function(sel){
                    var el = document.querySelector(sel);
                    if (el) { try { el.innerHTML = html; } catch(_) {} }
                  });
                });
              })
              .catch(function(){});
          } catch (_) {}
        }
        e.source && e.source.postMessage({
          type: 'stylys-cart-result',
          requestId: reqId,
          ok: added.length > 0,
          count: added.length,
          added: added,
          failed: failed,
          error: added.length === 0 ? (failed[0] && failed[0].reason) || 'Add to cart failed' : undefined
        }, '*');
      });
    }
  });

  function mount() {
    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    document.body.appendChild(btn);
  }

  if (document.body) {
    mount();
  } else {
    document.addEventListener('DOMContentLoaded', mount);
  }
})();
`;

  return new Response(widgetJs, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/javascript",
      // Short cache so brand resolution updates propagate quickly
      "Cache-Control": "public, max-age=300",
    },
  });
});
