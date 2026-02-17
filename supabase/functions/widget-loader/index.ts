const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const brandId = url.searchParams.get("brand_id");

  // The widget preview URL (hosted by the app)
  const widgetPreviewUrl = `${SUPABASE_URL.replace('.supabase.co', '').replace('https://mggxvtfgakplzzpcclte', 'https://stylysapp.lovable.app')}/widget-preview${brandId ? `?brand_id=${brandId}` : ''}`;
  
  // Use the published app URL for the widget iframe
  const appUrl = "https://stylysapp.lovable.app";

  const widgetJs = `
(function() {
  if (window.__stylysWidgetLoaded) return;
  window.__stylysWidgetLoaded = true;

  var brandId = '';
  var scripts = document.getElementsByTagName('script');
  for (var i = 0; i < scripts.length; i++) {
    var src = scripts[i].src || '';
    if (src.indexOf('widget-loader') !== -1) {
      var match = src.match(/brand_id=([^&]+)/);
      if (match) brandId = match[1];
    }
  }

  // Create floating button
  var btn = document.createElement('div');
  btn.id = 'stylys-trigger';
  btn.innerHTML = '<img src="https://stylysapp.lovable.app/favicon.png" alt="STYLYS" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" />';
  btn.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:999999;width:56px;height:56px;border-radius:50%;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,0.3);transition:transform 0.2s;';
  btn.onmouseenter = function() { btn.style.transform = 'scale(1.1)'; };
  btn.onmouseleave = function() { btn.style.transform = 'scale(1)'; };

  // Create overlay
  var overlay = document.createElement('div');
  overlay.id = 'stylys-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:999998;display:none;opacity:0;transition:opacity 0.3s;';

  // Create sidebar panel
  var panel = document.createElement('div');
  panel.id = 'stylys-panel';
  panel.style.cssText = 'position:fixed;top:0;right:-420px;width:400px;max-width:90vw;height:100vh;z-index:1000000;background:#fff;box-shadow:-4px 0 30px rgba(0,0,0,0.2);transition:right 0.3s ease;';

  var iframe = document.createElement('iframe');
  iframe.src = '${appUrl}/widget-preview' + (brandId ? '?brand_id=' + brandId : '');
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

  document.body.appendChild(overlay);
  document.body.appendChild(panel);
  document.body.appendChild(btn);
})();
`;

  return new Response(widgetJs, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
