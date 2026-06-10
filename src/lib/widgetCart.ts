// Bridges the widget (running inside an iframe on the merchant's Shopify
// storefront) to the parent storefront, which uses Shopify's AJAX cart API
// (`/cart/add.js`). The parent listener is installed by the widget-loader
// edge function. Variant IDs are numeric Shopify variant ids (extracted from
// `variants_json[].variant_id` or `shopify_variant_id` on `products`).

export interface CartAddItem {
  variantId: string | number;
  quantity?: number;
  name?: string;
}

export interface CartAddFailure {
  id: string;
  name: string;
  reason: string;
}

export interface CartAddResult {
  ok: boolean;
  error?: string;
  count?: number;
  added?: { id: string; name: string }[];
  failed?: CartAddFailure[];
}

const PARENT_TIMEOUT_MS = 15000;

function hasParent(): boolean {
  return typeof window !== "undefined" && window.parent && window.parent !== window;
}

/** Navigate the storefront (parent window) to /cart. */
export function openShopifyCart(): void {
  if (typeof window === "undefined") return;
  if (hasParent()) {
    window.parent.postMessage({ type: "stylys-open-cart" }, "*");
  } else {
    window.location.href = "/cart";
  }
}

/**
 * Extracts the numeric Shopify variant id from any format we may receive:
 *   - plain numeric string:   "47562317627604"
 *   - number:                 47562317627604
 *   - Admin GID:              "gid://shopify/ProductVariant/47562317627604"
 *   - Storefront GID:         "gid://shopify/ProductVariant/47562317627604?..."
 *   - Object with `.id`:      { id: "...", ... }
 *
 * Returns the id as a STRING of digits (variant ids can exceed
 * Number.MAX_SAFE_INTEGER, and /cart/add.js accepts string ids).
 */
export function toNumericVariantId(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return toNumericVariantId(o.variant_id ?? o.variantId ?? o.id);
  }
  const s = String(raw).trim();
  if (!s) return null;
  const noQuery = s.split("?")[0];
  const tail = noQuery.includes("/") ? noQuery.slice(noQuery.lastIndexOf("/") + 1) : noQuery;
  const digits = tail.match(/\d+/g);
  if (!digits || !digits.length) return null;
  const best = digits.reduce((a, b) => (b.length > a.length ? b : a));
  return /^[1-9]\d{0,19}$/.test(best) ? best : null;
}

async function addOneSameOrigin(item: { id: string; quantity: number; name: string }): Promise<{ ok: boolean; reason?: string }> {
  try {
    const resp = await fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ id: item.id, quantity: item.quantity }),
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      return { ok: false, reason: body?.description || body?.message || `HTTP ${resp.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

export async function addItemsToShopifyCart(items: CartAddItem[]): Promise<CartAddResult> {
  const cleaned = items
    .map((i) => {
      const id = toNumericVariantId(i.variantId);
      if (!id) return null;
      return { id, quantity: Math.max(1, Math.floor(i.quantity || 1)), name: i.name || "" };
    })
    .filter(Boolean) as { id: string; quantity: number; name: string }[];

  if (!cleaned.length) {
    console.warn("[widgetCart] No valid Shopify variant IDs after normalization", { received: items });
    return { ok: false, error: "No valid Shopify variant IDs", added: [], failed: [] };
  }

  // Same-origin path (merchant dashboard preview, or widget served from the storefront).
  // Add items one at a time so sold-out items don't block the rest.
  if (!hasParent()) {
    const added: { id: string; name: string }[] = [];
    const failed: CartAddFailure[] = [];
    for (const it of cleaned) {
      const r = await addOneSameOrigin(it);
      if (r.ok) added.push({ id: it.id, name: it.name });
      else failed.push({ id: it.id, name: it.name, reason: r.reason || "Unavailable" });
    }
    return {
      ok: added.length > 0,
      count: added.length,
      added,
      failed,
      error: added.length === 0 ? failed[0]?.reason || "Add to cart failed" : undefined,
    };
  }

  // Iframe path → ask the parent (widget-loader script) to call /cart/add.js per item.
  return new Promise<CartAddResult>((resolve) => {
    const requestId = `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let settled = false;
    const onMessage = (event: MessageEvent) => {
      const d = event.data;
      if (!d || d.type !== "stylys-cart-result" || d.requestId !== requestId) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      resolve({
        ok: !!d.ok,
        error: d.error,
        count: d.count,
        added: Array.isArray(d.added) ? d.added : [],
        failed: Array.isArray(d.failed) ? d.failed : [],
      });
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "stylys-add-to-cart", requestId, items: cleaned }, "*");
    setTimeout(() => {
      if (settled) return;
      window.removeEventListener("message", onMessage);
      resolve({ ok: false, error: "Cart request timed out", added: [], failed: [] });
    }, PARENT_TIMEOUT_MS);
  });
}
