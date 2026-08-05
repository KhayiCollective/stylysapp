// Vercel Edge Middleware — injects Shopify App Bridge into the HTML shell for
// embedded admin routes. Widget routes are deliberately excluded: loading App
// Bridge in a storefront iframe causes window.fetch to be monkey-patched in a
// way that hangs Supabase Edge Function requests (confirmed incident, 2026-07-08).

const WIDGET_ROUTES = new Set([
  "/widget-preview",
  "/widget-reset-password",
  "/widget-chat",
]);

export const config = {
  // Only intercept extensionless SPA routes — not static assets (.js, .css,
  // .html, .png …). This prevents the fetch('/index.html') call below from
  // re-entering this middleware.
  matcher: ["/((?!_vercel|.*\\..*).*)", "/"],
};

export default async function middleware(
  request: Request
): Promise<Response | undefined> {
  const url = new URL(request.url);

  // Widget routes: pass through — no App Bridge.
  if (WIDGET_ROUTES.has(url.pathname)) {
    return undefined;
  }

  // Only inject App Bridge when Shopify signals an embedded context via ?shop=.
  // Standalone routes (login, reset-password, marketing pages) must NOT get
  // App Bridge — loading it outside the Admin iframe triggers the same
  // window.fetch monkey-patch hang documented in commit f46f644 (2026-07-08).
  if (!url.searchParams.has("shop")) {
    return undefined;
  }

  const apiKey = process.env.SHOPIFY_API_KEY;
  if (!apiKey) {
    // Fail open: serve index.html as-is so the app still loads.
    return undefined;
  }

  // Fetch the static index.html. The .html extension excludes this URL from
  // the matcher above, so there is no recursion risk.
  const indexRes = await fetch(new URL("/index.html", url.origin));
  if (!indexRes.ok) return undefined;

  const html = await indexRes.text();

  // Inject as the very first child of <head> so App Bridge loads before any
  // other script (including the Vite entry bundle).
  const appBridgeTags =
    `<meta name="shopify-api-key" content="${apiKey}">\n` +
    `    <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>`;

  const modified = html.replace("<head>", `<head>\n    ${appBridgeTags}`);

  return new Response(modified, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Don't let CDNs cache the injected API key.
      "cache-control": "no-store",
    },
  });
}
