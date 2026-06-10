// Bridges the widget (running inside an iframe on the merchant's Shopify
// storefront) to the parent storefront, which uses Shopify's AJAX cart API
// (`/cart/add.js`). The parent listener is installed by the widget-loader
// edge function. Variant IDs are numeric Shopify variant ids (extracted from
// `variants_json[].variant_id` or `shopify_variant_id` on `products`).

export interface CartAddItem {
  variantId: string | number;
  quantity?: number;
}

export interface CartAddResult {
  ok: boolean;
  error?: string;
  count?: number;
}

const PARENT_TIMEOUT_MS = 8000;

function hasParent(): boolean {
  return typeof window !== "undefined" && window.parent && window.parent !== window;
}

/**
 * Extracts the numeric Shopify variant id from any of the formats we may
 * receive (plain numeric string, GID, or number).
 */
export function toNumericVariantId(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw);
  const m = s.match(/(\d+)\s*$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function addItemsToShopifyCart(items: CartAddItem[]): Promise<CartAddResult> {
  const cleaned = items
    .map((i) => {
      const id = toNumericVariantId(i.variantId);
      if (!id) return null;
      return { id, quantity: Math.max(1, Math.floor(i.quantity || 1)) };
    })
    .filter(Boolean) as { id: number; quantity: number }[];

  if (!cleaned.length) return { ok: false, error: "No valid Shopify variant IDs" };

  // Same-origin (merchant dashboard preview, or running directly on the storefront)
  if (!hasParent()) {
    try {
      const resp = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ items: cleaned }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        return { ok: false, error: body?.description || body?.message || `HTTP ${resp.status}` };
      }
      return { ok: true, count: cleaned.length };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  // Inside an iframe → ask the parent (widget-loader script) to call /cart/add.js
  return new Promise<CartAddResult>((resolve) => {
    const requestId = `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let settled = false;
    const onMessage = (event: MessageEvent) => {
      const d = event.data;
      if (!d || d.type !== "stylys-cart-result" || d.requestId !== requestId) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      resolve({ ok: !!d.ok, error: d.error, count: d.count });
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "stylys-add-to-cart", requestId, items: cleaned }, "*");
    setTimeout(() => {
      if (settled) return;
      window.removeEventListener("message", onMessage);
      resolve({ ok: false, error: "Cart request timed out" });
    }, PARENT_TIMEOUT_MS);
  });
}
