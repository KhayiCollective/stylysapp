import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, ShoppingBag, Trash2, Loader2, LogIn } from "lucide-react";
import { addItemsToShopifyCart, openShopifyCart, toNumericVariantId } from "@/lib/widgetCart";
import { NotifyMeButton } from "@/components/widget/NotifyMeButton";
import { toast } from "sonner";

interface SavedOutfit {
  id: string;
  name: string | null;
  outfit_data: any;
  created_at: string;
}

interface WishlistTabProps {
  brandId?: string;
}

import { getCustomerToken } from "@/lib/widgetAuth";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function getToken(_brandId?: string) {
  return getCustomerToken();
}

export function WishlistTab({ brandId }: WishlistTabProps) {
  const [outfits, setOutfits] = useState<SavedOutfit[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  // Map of shopify_variant_id (numeric string) -> in_stock boolean.
  // Items without a known variant default to in-stock (treat as available).
  const [stockMap, setStockMap] = useState<Record<string, boolean>>({});

  const isItemInStock = (it: any): boolean => {
    const vid = toNumericVariantId(it?.shopify_variant_id ?? it?.variant_id ?? it?.id);
    if (!vid) return true; // unknown variant → don't block; cart layer will handle
    if (vid in stockMap) return stockMap[vid];
    return true;
  };

  const handleAddOutfitToCart = async (outfit: SavedOutfit) => {
    const items: any[] = Array.isArray(outfit.outfit_data?.items) ? outfit.outfit_data.items : [];

    // Exclude sold-out items entirely — they should never be added to cart.
    const valid = items
      .filter((it: any) => isItemInStock(it))
      .map((it: any) => {
        const variantId = toNumericVariantId(it?.shopify_variant_id ?? it?.variant_id ?? it?.id);
        return variantId ? { variantId, quantity: 1, name: String(it?.name || "") } : null;
      })
      .filter((v): v is { variantId: string; quantity: number; name: string } => v !== null);

    if (!valid.length) {
      toast.error("Cannot add to cart", {
        description: "These saved items are sold out or have no valid Shopify variant IDs.",
        position: "top-center",
      });
      return;
    }

    setAddingId(outfit.id);
    try {
      const result = await addItemsToShopifyCart(valid);

      const added = result.added || [];
      const soldOut = result.failed || [];

      const noIdNames = items
        .filter((it: any) => isItemInStock(it) && toNumericVariantId(it?.shopify_variant_id ?? it?.variant_id ?? it?.id) === null)
        .map((it: any) => String(it?.name || "")).filter(Boolean);
      const soldOutLocalNames = items
        .filter((it: any) => !isItemInStock(it))
        .map((it: any) => String(it?.name || "")).filter(Boolean);

      const unavailableNames = [...soldOut.map((f) => f.name).filter(Boolean), ...soldOutLocalNames, ...noIdNames];

      if (added.length === 0) {
        toast.error("Couldn't add items to cart", {
          description: unavailableNames.length
            ? `Sold out: ${unavailableNames.join(", ")}`
            : result.error || "All items unavailable",
          position: "top-center",
        });
        return;
      }

      let description = `Added ${added.length} item${added.length === 1 ? "" : "s"} to cart.`;
      if (unavailableNames.length) {
        description += unavailableNames.length === 1
          ? ` Note: ${unavailableNames[0]} is currently sold out and was not added.`
          : ` Note: ${unavailableNames.join(", ")} are currently sold out and were not added.`;
      }

      toast.success("Added to cart", {
        description,
        position: "top-center",
        duration: unavailableNames.length ? 8000 : 6000,
        action: { label: "View Cart", onClick: () => openShopifyCart() },
      });
    } finally {
      setAddingId(null);
    }
  };

  const token = getToken(brandId);
  const isLoggedIn = !!token;

  const fetchSaved = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/widget-outfits/saved`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (resp.ok) setOutfits(data.outfits || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchSaved(); }, [brandId, isLoggedIn]);

  // Whenever saved outfits change, look up live stock status for their variants
  // so we can show Sold Out badges and block sold-out items from cart adds.
  useEffect(() => {
    const variantIds = Array.from(new Set(
      outfits.flatMap((o) => {
        const items: any[] = Array.isArray(o.outfit_data?.items) ? o.outfit_data.items : [];
        return items
          .map((it) => toNumericVariantId(it?.shopify_variant_id ?? it?.variant_id ?? it?.id))
          .filter((v): v is string => !!v);
      })
    ));
    if (!variantIds.length) return;
    const shopFromUrl = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("shop") || undefined
      : undefined;
    const shopFromGlobal = typeof window !== "undefined"
      ? (window as unknown as { Shopify?: { shop?: string } }).Shopify?.shop
      : undefined;
    const shop = shopFromUrl || shopFromGlobal;
    (async () => {
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/widget-outfits/stock`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ brand_id: brandId, shop, variant_ids: variantIds }),
        });
        const data = await resp.json();
        if (resp.ok && data?.stock) setStockMap(data.stock);
      } catch { /* ignore */ }
    })();
  }, [outfits, brandId]);

  const handleDelete = async (outfitId: string) => {
    if (!token) return;
    setDeleting(outfitId);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/widget-outfits/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ outfit_id: outfitId }),
      });
      if (resp.ok) {
        setOutfits(prev => prev.filter(o => o.id !== outfitId));
      }
    } catch { /* ignore */ }
    setDeleting(null);
  };

  if (!isLoggedIn) {
    return (
      <div className="p-4 text-center py-12 text-muted-foreground">
        <Heart className="h-8 w-8 mx-auto mb-3 opacity-50" />
        <p className="text-sm font-medium">Sign in to see saved outfits</p>
        <p className="text-xs mt-1 flex items-center justify-center gap-1">
          <LogIn className="h-3 w-3" /> Go to Account tab to sign in
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-base">Saved Outfits</h3>
        <p className="text-xs text-muted-foreground">{outfits.length} saved look{outfits.length !== 1 ? "s" : ""}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : outfits.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Heart className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">No saved outfits yet</p>
          <p className="text-xs mt-1">Save outfits from the Outfits tab by tapping the heart icon.</p>
        </div>
      ) : (
        outfits.map((outfit) => {
          const items = Array.isArray(outfit.outfit_data?.items) ? outfit.outfit_data.items : [];
          const availableTotal = items
            .filter((i: any) => isItemInStock(i))
            .reduce((s: number, i: any) => s + Number(i.price || 0), 0);

          return (
            <div key={outfit.id} className="border border-border rounded-lg overflow-hidden">
              <div className="p-3 flex items-center justify-between bg-muted/30">
                <div>
                  <p className="font-medium text-sm">{outfit.name || outfit.outfit_data?.name || "Saved Look"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Saved {new Date(outfit.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(outfit.id)}
                  disabled={deleting === outfit.id}
                  className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                >
                  {deleting === outfit.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              </div>

              {items.length > 0 && (
                <div className="grid grid-cols-3 gap-px bg-border">
                  {items.slice(0, 6).map((item: any, idx: number) => {
                    const inStock = isItemInStock(item);
                    return (
                      <div key={item.id || idx} className="bg-card">
                        <div className="aspect-square overflow-hidden relative">
                          <img
                            src={item.imageUrl || item.image_url || ""}
                            alt={item.name || "Product"}
                            className={`w-full h-full object-cover ${!inStock ? "opacity-60" : ""}`}
                          />
                          {!inStock && (
                            <span className="absolute top-1 left-1 bg-destructive text-destructive-foreground text-[9px] font-semibold px-1.5 py-0.5 rounded">
                              Sold Out
                            </span>
                          )}
                        </div>
                        <div className="p-1.5">
                          <p className="text-[10px] truncate">{item.name}</p>
                          {!inStock ? (
                            <>
                              <p className="text-[10px] text-muted-foreground line-through">${Number(item.price || 0).toFixed(0)}</p>
                              <div className="mt-1">
                                <NotifyMeButton
                                  brandId={brandId}
                                  productId={item.id}
                                  shopifyVariantId={item.shopify_variant_id ?? item.variant_id ?? null}
                                  productName={item.name}
                                />
                              </div>
                            </>
                          ) : (
                            <p className="text-[10px] text-muted-foreground">${Number(item.price || 0).toFixed(0)}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="p-3 flex items-center justify-between border-t border-border">
                <span className="font-semibold text-sm">${availableTotal.toFixed(2)}</span>
                <Button
                  size="sm"
                  className="text-xs h-8 gap-1"
                  onClick={() => handleAddOutfitToCart(outfit)}
                  disabled={addingId === outfit.id}
                >
                  {addingId === outfit.id
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <ShoppingBag className="h-3 w-3" />}
                  Add All to Cart
                </Button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
