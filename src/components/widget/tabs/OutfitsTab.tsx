import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, ShoppingBag, Sparkles, RefreshCw, Loader2, LogIn, Camera } from "lucide-react";
import { addItemsToShopifyCart, openShopifyCart, toNumericVariantId } from "@/lib/widgetCart";
import { NotifyMeButton } from "@/components/widget/NotifyMeButton";
import { toast } from "sonner";
import type { QuizAnswers } from "./StyleQuizTab";

interface OutfitItem {
  id: string;
  name: string;
  image_url?: string;
  imageUrl?: string;
  price: number;
  category: string;
  shopify_variant_id?: string;
  in_stock?: boolean;
  available?: boolean;
}

// Single source of truth: an item is buyable only when neither flag is explicitly false
// and (if we have live stock data) the variant is in stock per Shopify right now.
const isAvailableWithStock = (
  i: { available?: boolean; in_stock?: boolean; shopify_variant_id?: string },
  stockMap: Record<string, boolean>,
) => {
  if (i.available === false || i.in_stock === false) return false;
  const vid = toNumericVariantId(i.shopify_variant_id);
  if (vid && vid in stockMap) return stockMap[vid];
  return true;
};

interface Outfit {
  id: string;
  name: string;
  items: OutfitItem[];
  totalPrice: number;
  occasion?: string;
}

interface OutfitsTabProps {
  brandId?: string;
  onSelectOutfitForTryOn?: (items: { name: string; imageUrl: string; category: string }[]) => void;
  anchorProductId?: string;
  anchorProductName?: string;
  onClearAnchor?: () => void;
  quizAnswers?: QuizAnswers;
}

import { getCustomerToken } from "@/lib/widgetAuth";

const SUPABASE_URL = "https://agvobtjeizdoppzkvyyu.supabase.co";

function getToken(_brandId?: string) {
  return getCustomerToken();
}

export function OutfitsTab({ brandId, onSelectOutfitForTryOn, anchorProductId, anchorProductName, onClearAnchor, quizAnswers }: OutfitsTabProps) {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [error, setError] = useState("");
  // Live Shopify stock for the variants in the currently-generated outfits.
  const [stockMap, setStockMap] = useState<Record<string, boolean>>({});

  const isLoggedIn = !!getToken(brandId);

  // Build customer_profile from stored token
  const getCustomerProfile = async () => {
    const token = getToken(brandId);
    if (!token) return null;
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/widget-customer-auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (data.user?.styleProfile) return data.user.styleProfile;
    } catch { /* ignore */ }
    return null;
  };

  const fetchOutfits = async () => {
    // Always re-derive shop from the current URL (or Shopify.shop when running
    // inside the storefront) so brand_id is resolved fresh on EVERY API call.
    const shopFromUrl = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("shop") || undefined
      : undefined;
    const shopFromGlobal = typeof window !== "undefined"
      ? (window as unknown as { Shopify?: { shop?: string } }).Shopify?.shop
      : undefined;
    const shop = shopFromUrl || shopFromGlobal;

    if (!brandId && !shop) return;
    setLoading(true);
    setError("");
    try {
      // Fetch composition rules and customer profile concurrently — they're independent
      const [compositionRules, customerProfile] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/rules?category=eq.composition&brand_id=eq.${brandId}&select=config,enabled&limit=1`, {
          headers: {
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json"
          },
        })
          .then((r) => r.json())
          .then((data: any) => (data?.[0]?.enabled && data[0].config ? data[0].config : undefined))
          .catch(() => undefined),
        getCustomerProfile(),
      ]);

      const body: Record<string, unknown> = { brand_id: brandId, shop, rules: compositionRules, anchor_product_id: anchorProductId };
      if (customerProfile) body.customer_profile = customerProfile;
      if (quizAnswers) body.quiz_session = quizAnswers;

      let resp = await fetch(`${SUPABASE_URL}/functions/v1/widget-outfits/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify(body),
      });
      if (!resp.ok && resp.status >= 500) {
        await new Promise(r => setTimeout(r, 1500));
        resp = await fetch(`${SUPABASE_URL}/functions/v1/widget-outfits/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          body: JSON.stringify(body),
        });
      }
      const data = await resp.json();
      if (!resp.ok) { setError(data.error || "Failed to load outfits"); return; }
      setOutfits((data.outfits || []).map((o: any) => ({
        id: o.id,
        name: o.name || "Look",
        items: (o.items || []).map((i: any) => ({
          id: i.id, name: i.name, price: Number(i.price),
          imageUrl: i.image_url || i.imageUrl,
          category: i.category,
          shopify_variant_id: i.shopify_variant_id,
          in_stock: i.in_stock !== false,
          available: i.available !== false && i.in_stock !== false,
        })),
        totalPrice: o.totalPrice,
        occasion: o.occasion,
      })));
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOutfits(); }, [brandId, anchorProductId]);

  // Re-fetch when quiz answers change (user just completed the quiz)
  useEffect(() => {
    if (quizAnswers) fetchOutfits();
  }, [quizAnswers]);

  // Whenever outfits change, look up live Shopify stock for their variants so
  // sold-out items are blocked from cart adds even if the DB inventory_status
  // or variants_json is stale.
  useEffect(() => {
    const variantIds = Array.from(new Set(
      outfits.flatMap((o) =>
        o.items
          .map((i) => toNumericVariantId(i.shopify_variant_id))
          .filter((v): v is string => !!v)
      )
    ));
    if (!variantIds.length) { setStockMap({}); return; }
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

  const toggleSave = async (outfit: Outfit) => {
    const token = getToken(brandId);
    if (!token) return;
    setSaving(outfit.id);
    try {
      if (savedIds.has(outfit.id)) {
        setSavedIds(prev => { const n = new Set(prev); n.delete(outfit.id); return n; });
      } else {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/widget-outfits/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ outfit_data: outfit, name: outfit.name }),
        });
        if (resp.ok) {
          setSavedIds(prev => new Set(prev).add(outfit.id));
        }
      }
    } catch { /* ignore */ }
    setSaving(null);
  };

  const handleTryOn = (outfit: Outfit) => {
    const items = outfit.items.map(i => ({
      id: i.id,
      name: i.name,
      imageUrl: i.imageUrl || i.image_url || "",
      category: i.category,
      shopify_variant_id: i.shopify_variant_id,
      price: i.price,
    }));
    onSelectOutfitForTryOn?.(items);
  };

  const handleAddAllToCart = async (outfit: Outfit) => {
    // Exclude sold-out items entirely — they should never be added to cart.
    const valid = outfit.items
      .filter((item) => isAvailableWithStock(item, stockMap))
      .map((item) => ({ item, variantId: toNumericVariantId(item.shopify_variant_id) }))
      .filter((x) => x.variantId !== null);

    if (valid.length === 0) {
      toast.error("Cannot add to cart", {
        description: "These outfit items don't have valid Shopify variant IDs.",
        position: "top-center",
      });
      return;
    }

    setAddingToCart(outfit.id);
    try {
      const result = await addItemsToShopifyCart(
        valid.map((v) => ({ variantId: v.variantId as string, quantity: 1, name: v.item.name }))
      );

      const added = result.added || [];
      const soldOut = result.failed || [];
      const noIdSkipped = outfit.items.length - valid.length;

      // Names of items that have no valid variant ID at all (excluding sold-out)
      const noIdNames = outfit.items
        .filter((item) => isAvailableWithStock(item, stockMap) && toNumericVariantId(item.shopify_variant_id) === null)
        .map((item) => item.name);
      // Names of items skipped because they're sold out
      const soldOutLocalNames = outfit.items
        .filter((item) => !isAvailableWithStock(item, stockMap))
        .map((item) => item.name);

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
      } else if (noIdSkipped > 0) {
        description += ` (${noIdSkipped} skipped — no Shopify variant)`;
      }

      toast.success(`Added "${outfit.name}" to cart`, {
        description,
        position: "top-center",
        duration: unavailableNames.length ? 8000 : 6000,
        action: { label: "View Cart", onClick: () => openShopifyCart() },
      });
    } catch (error) {
      console.error('Failed to add outfit to cart:', error);
      toast.error("Failed to add items to cart", { position: "top-center" });
    } finally {
      setAddingToCart(null);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {anchorProductName && (
        <div className="flex items-center gap-2 bg-primary/10 text-primary rounded-lg px-3 py-2">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span className="text-xs font-medium flex-1">Outfits built around <strong>{anchorProductName}</strong></span>
          <button
            onClick={onClearAnchor}
            className="text-[10px] font-medium text-primary/70 hover:text-primary underline shrink-0"
          >
            Clear
          </button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base">Your Outfits</h3>
          <p className="text-xs text-muted-foreground">
            {quizAnswers ? `Styled for ${quizAnswers.occasion || "you"} · ${quizAnswers.colorMood || ""}` : "AI-curated looks for you"}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={fetchOutfits} disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground ml-2">Generating outfits...</span>
        </div>
      ) : outfits.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">No outfits yet</p>
          <p className="text-xs mt-1">No products available to create outfits from.</p>
        </div>
      ) : (
        outfits.map((outfit) => (
          <div key={outfit.id} className="border border-border rounded-lg overflow-hidden">
            <div className="p-3 flex items-center justify-between bg-muted/30">
              <div>
                <p className="font-medium text-sm">{outfit.name}</p>
                {outfit.occasion && <Badge variant="secondary" className="text-[10px] mt-1">{outfit.occasion}</Badge>}
              </div>
              {isLoggedIn ? (
                <button
                  onClick={() => toggleSave(outfit)}
                  disabled={saving === outfit.id}
                  className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                >
                  <Heart className={`h-4 w-4 ${savedIds.has(outfit.id) ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
                </button>
              ) : (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <LogIn className="h-3 w-3" /> Sign in to save
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-px bg-border">
              {outfit.items.map((item) => (
                <div key={item.id} className="bg-card">
                  <div className="aspect-square overflow-hidden relative">
                    <img
                      src={item.imageUrl || item.image_url || ""}
                      alt={item.name}
                      className={`w-full h-full object-cover ${!isAvailableWithStock(item, stockMap) ? "opacity-60" : ""}`}
                    />
                    {!isAvailableWithStock(item, stockMap) && (
                      <span className="absolute top-1 left-1 bg-destructive text-destructive-foreground text-[9px] font-semibold px-1.5 py-0.5 rounded">
                        Sold Out
                      </span>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-[11px] truncate">{item.name}</p>
                    {!isAvailableWithStock(item, stockMap) ? (
                      <>
                        <p className="text-[11px] text-muted-foreground line-through">${item.price}</p>
                        <div className="mt-1">
                          <NotifyMeButton
                            brandId={brandId}
                            productId={item.id}
                            shopifyVariantId={item.shopify_variant_id || null}
                            productName={item.name}
                          />
                        </div>
                      </>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">${item.price}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 flex items-center justify-between border-t border-border gap-2">
              <span className="font-semibold text-sm">
                ${outfit.items.filter(i => isAvailableWithStock(i, stockMap)).reduce((s, i) => s + Number(i.price || 0), 0).toFixed(2)}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-xs h-8 gap-1" onClick={() => handleTryOn(outfit)}>
                  <Camera className="h-3 w-3" />
                  Try On
                </Button>
                <Button size="sm" className="text-xs h-8 gap-1" onClick={() => handleAddAllToCart(outfit)} disabled={addingToCart === outfit.id}>
                  {addingToCart === outfit.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShoppingBag className="h-3 w-3" />}
                  Add All
                </Button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
