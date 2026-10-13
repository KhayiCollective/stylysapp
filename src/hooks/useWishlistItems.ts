import { useCallback, useEffect, useState } from "react";
import { getCustomerToken } from "@/lib/widgetAuth";

const SUPABASE_URL = "https://agvobtjeizdoppzkvyyu.supabase.co";

export interface WishlistItem {
  saved_id?: string;
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  category: string;
  shopify_variant_id?: string;
  shopify_product_id?: string;
  in_stock?: boolean;
}

export type ToggleRef = { item_id?: string; shopify_product_id?: string };
export type ToggleResult = {
  ok: boolean;
  saved?: boolean;
  reason?: "login" | "unavailable" | "error";
};

function currentShop(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return (
    new URLSearchParams(window.location.search).get("shop") ||
    (window as unknown as { Shopify?: { shop?: string } }).Shopify?.shop ||
    undefined
  );
}

/**
 * Pro-plan wishlist of individual products. `enabled` is false for stores
 * whose plan doesn't include the feature, so every consumer can simply render
 * nothing when it's off.
 */
export function useWishlistItems(brandId?: string, customerToken?: string | null) {
  const [enabled, setEnabled] = useState(false);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/widget-outfits/features`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brand_id: brandId, shop: currentShop() }),
        });
        const data = await resp.json();
        if (!cancelled) setEnabled(!!data?.wishlist_items);
      } catch {
        if (!cancelled) setEnabled(false);
      }
    })();
    return () => { cancelled = true; };
  }, [brandId]);

  const refresh = useCallback(async () => {
    const token = getCustomerToken();
    if (!enabled || !token) { setItems([]); return; }
    setLoading(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/widget-outfits/items`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      setItems(resp.ok ? (data.items || []) : []);
    } catch {
      /* keep previous list */
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { refresh(); }, [refresh, customerToken]);

  const toggle = useCallback(async (ref: ToggleRef): Promise<ToggleResult> => {
    const token = getCustomerToken();
    if (!token) return { ok: false, reason: "login" };
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/widget-outfits/toggle-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(ref),
      });
      const data = await resp.json();
      if (resp.status === 401) return { ok: false, reason: "login" };
      if (resp.status === 403) return { ok: false, reason: "unavailable" };
      if (!resp.ok) return { ok: false, reason: "error" };
      await refresh();
      return { ok: true, saved: !!data.saved };
    } catch {
      return { ok: false, reason: "error" };
    }
  }, [refresh]);

  const isSaved = useCallback((itemId?: string) => !!itemId && items.some(i => i.id === itemId), [items]);

  return { enabled, items, loading, isSaved, toggle, refresh };
}

export type WishlistApi = ReturnType<typeof useWishlistItems>;
