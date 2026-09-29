// Writes static HTML for public pages so crawlers see real content.
// dist/app-shell.html = untouched SPA shell (served for every other route via
// vercel.json and by middleware.ts for embedded ?shop= loads).
// Never fails the build: if prerendering breaks, pages just stay client-rendered.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const template = fs.readFileSync(path.join(dist, "index.html"), "utf8");
fs.writeFileSync(path.join(dist, "app-shell.html"), template);

const SITE = "https://stylysapp.com";
const pages = [
  { url: "/", file: "index.html" },
  { url: "/docs", file: "docs.html", title: "STYLYS Docs – Getting Started", desc: "Set up STYLYS on your Shopify store: connect your catalog, add the widget and start offering AI styling and virtual try-on." },
  { url: "/docs/getting-started", file: "docs/getting-started.html", title: "Getting Started with STYLYS", desc: "Set up STYLYS on your Shopify store: connect your catalog, add the widget and start offering AI styling and virtual try-on." },
  { url: "/docs/shopify-setup", file: "docs/shopify-setup.html", title: "Shopify Setup – STYLYS Docs", desc: "Install STYLYS from the Shopify App Store and sync your products for AI outfit building and virtual try-on." },
  { url: "/docs/widget-embed", file: "docs/widget-embed.html", title: "Add the STYLYS Widget to Your Theme – STYLYS Docs", desc: "Enable the STYLYS app embed in your Shopify theme so shoppers can build outfits and try them on." },
  { url: "/docs/faq", file: "docs/faq.html", title: "FAQ – STYLYS Docs", desc: "Answers to common questions about STYLYS AI styling, virtual try-on, pricing and Shopify setup." },
  { url: "/privacy", file: "privacy.html", title: "Privacy Policy – STYLYS", desc: "How STYLYS collects, uses and protects merchant and shopper data." },
  { url: "/terms", file: "terms.html", title: "Terms of Service – STYLYS", desc: "Terms of Service for the STYLYS AI stylist app for Shopify." },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function withMeta(html, p) {
  if (!p.title) return html;
  const url = SITE + p.url;
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(p.title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(p.desc)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(p.title)}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(p.title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(p.desc)}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${esc(p.desc)}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`);
}

try {
  // Browser globals some modules touch at import time (e.g. Supabase auth storage).
  const mem = new Map();
  globalThis.localStorage ??= { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0 };
  globalThis.sessionStorage ??= globalThis.localStorage;

  const { render } = await import(pathToFileURL(path.join(root, "dist-ssr", "entry-server.js")).href);
  let ok = 0;
  for (const p of pages) {
    try {
      const body = render(p.url);
      if (!body || body.length < 200) throw new Error("empty render");
      const html = withMeta(template, p).replace('<div id="root"></div>', `<div id="root">${body}</div>`);
      const out = path.join(dist, p.file);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, html);
      ok++;
      console.log(`prerender: ${p.url} -> ${p.file} (${body.length} chars)`);
    } catch (e) {
      console.warn(`prerender: skipped ${p.url}: ${e.message}`);
    }
  }
  console.log(`prerender: ${ok}/${pages.length} pages`);
} catch (e) {
  console.warn(`prerender: disabled (${e.message}); site stays client-rendered`);
} finally {
  fs.rmSync(path.join(root, "dist-ssr"), { recursive: true, force: true });
}
