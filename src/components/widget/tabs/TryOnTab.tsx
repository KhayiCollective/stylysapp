import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Loader2, Sparkles, Eye, User, ShoppingBag, X, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { addItemsToShopifyCart, openShopifyCart, toNumericVariantId } from "@/lib/widgetCart";
import { toast } from "sonner";
import { PhotoUpload, getCachedPhotoUrl, setCachedPhotoUrl, clearCachedPhoto } from "../PhotoUpload";
import { WishlistHeart } from "../WishlistHeart";
import type { WishlistApi } from "@/hooks/useWishlistItems";

const PROCESSING_MESSAGES = [
  "Analyzing your photo...",
  "Reading the garments...",
  "Fitting the outfit to your body...",
  "Blending lighting and shadows...",
  "Adding final touches...",
  "Almost there...",
];
const PROCESSING_DELAYS = [8000, 18000, 30000, 42000, 52000];

interface OutfitItemProp {
  id?: string;
  name: string;
  imageUrl: string;
  category: string;
  shopify_variant_id?: string;
  price?: number;
}

interface TryOnTabProps {
  outfitItems?: OutfitItemProp[];
  customerPhotoUrl?: string;
  brandId?: string;
  customerToken?: string;
  onPhotoSaved?: (url: string) => void;
  bodyShape?: string;
  sizeInfo?: Record<string, string>;
  wishlist?: WishlistApi;
}

export function TryOnTab({ outfitItems, customerPhotoUrl, brandId, customerToken, onPhotoSaved, bodyShape, sizeInfo, wishlist }: TryOnTabProps) {
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusIndex, setStatusIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showingOriginal, setShowingOriginal] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  // Local, editable copy of the outfit: lets the customer X out a piece they
  // don't want in the try-on, or swap it for another in-stock option from the
  // same category. Edits only mark the look as changed — the (paid) image
  // generation re-runs when they tap the main button, not on every tweak.
  const [items, setItems] = useState<OutfitItemProp[]>(outfitItems ?? []);
  const [dirty, setDirty] = useState(false);
  const [swapIdx, setSwapIdx] = useState<number | null>(null);
  const [alternatives, setAlternatives] = useState<OutfitItemProp[]>([]);
  const [loadingAlts, setLoadingAlts] = useState(false);

  useEffect(() => {
    setItems(outfitItems ?? []);
    setDirty(false);
    setSwapIdx(null);
  }, [outfitItems]);

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
    setSwapIdx(null);
  };

  const openSwap = async (idx: number) => {
    if (swapIdx === idx) { setSwapIdx(null); return; }
    const item = items[idx];
    setSwapIdx(idx);
    setAlternatives([]);
    setLoadingAlts(true);
    try {
      const shop = new URLSearchParams(window.location.search).get("shop")
        || (window as unknown as { Shopify?: { shop?: string } }).Shopify?.shop;
      const resp = await fetch("https://agvobtjeizdoppzkvyyu.supabase.co/functions/v1/widget-outfits/alternatives", {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({
          brand_id: brandId,
          shop,
          item_id: item.id,
          category: item.category,
          name: item.name,
          exclude_ids: items.map(i => i.id).filter(Boolean),
        }),
      });
      const data = await resp.json();
      setAlternatives(resp.ok ? (data.alternatives || []) : []);
    } catch {
      setAlternatives([]);
    } finally {
      setLoadingAlts(false);
    }
  };

  const swapItem = (alt: OutfitItemProp) => {
    if (swapIdx === null) return;
    setItems(prev => prev.map((it, i) => (i === swapIdx ? alt : it)));
    setDirty(true);
    setSwapIdx(null);
  };

  // Auto-load: check cache first, then saved photo from account. When a photo
  // is already on file, immediately kick off generation too — previously the
  // customer had to tap "Try On" on an outfit card AND THEN tap "Try It On"
  // again here, even though nothing was actually missing. That's only a real
  // two-step flow when there's no photo yet (upload, then generate); with a
  // saved photo already available it's just a redundant click.
  useEffect(() => {
    if (currentPhoto) return;
    const cached = getCachedPhotoUrl(brandId);
    if (cached) {
      setCurrentPhoto(cached);
      if (outfitItems?.length) generateTryOn(cached);
    } else if (customerPhotoUrl) {
      setCurrentPhoto(customerPhotoUrl);
      setCachedPhotoUrl(brandId, customerPhotoUrl);
      if (outfitItems?.length) generateTryOn(customerPhotoUrl);
    }
  }, [customerPhotoUrl, brandId]);

  useEffect(() => {
    if (!isProcessing) {
      setStatusIndex(0);
      return;
    }
    setStatusIndex(0);
    const timers = PROCESSING_DELAYS.map((delay, i) =>
      setTimeout(() => setStatusIndex(i + 1), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [isProcessing]);

  const handlePhotoReady = (base64OrUrl: string) => {
    setCurrentPhoto(base64OrUrl);
    setResultImage(null);
    setShowingOriginal(false);
    setError(null);
  };

  const handlePhotoCleared = () => {
    setCurrentPhoto(null);
    setResultImage(null);
    setShowingOriginal(false);
    setError(null);
  };

  const handlePhotoSaved = (url: string) => {
    setCachedPhotoUrl(brandId, url);
    onPhotoSaved?.(url);
  };

  // Accepts an explicit photo so the auto-load effect above can kick off
  // generation immediately with the just-resolved cached/saved photo —
  // calling this with no argument (as the manual button does) would
  // otherwise read a stale `currentPhoto` still null from the same render
  // pass, since the setCurrentPhoto() call right before it hasn't committed yet.
  const generateTryOn = async (photoOverride?: string) => {
    const photo = photoOverride ?? currentPhoto;
    if (!photo || !items.length) return;
    setIsProcessing(true);
    setError(null);
    setDirty(false);

    try {
      // If the photo is a saved-photo signed URL, fetch and re-encode as
      // base64 client-side so the edge function never has to hit Storage directly.
      let photoPayload = photo;
      if (photo.startsWith("https://")) {
        try {
          const imgResp = await fetch(photo);
          if (!imgResp.ok) throw new Error(`status ${imgResp.status}`);
          const blob = await imgResp.blob();
          photoPayload = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch {
          clearCachedPhoto(brandId);
          setCurrentPhoto(null);
          setError("Your saved photo has expired. Please upload a new photo to continue.");
          setIsProcessing(false);
          return;
        }
      }

      const requestBody: Record<string, unknown> = {
        userImageBase64: photoPayload,
        outfitItems: items.map(i => ({
          name: i.name,
          imageUrl: i.imageUrl,
          category: i.category,
        })),
      };
      if (bodyShape) requestBody.bodyShape = bodyShape;
      if (sizeInfo && Object.values(sizeInfo).some(v => v)) requestBody.sizeInfo = sizeInfo;

      const { data, error: fnError } = await supabase.functions.invoke("virtual-tryon", {
        body: requestBody,
      });

      if (fnError) throw fnError;

      if (data?.success && data?.resultImage) {
        setResultImage(data.resultImage);
        setShowingOriginal(false);
      } else {
        setError(data?.message || "Could not generate try-on. Try a different photo.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to process. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddAllToCart = async () => {
    if (!items.length) return;

    const valid = items
      .map((item) => ({ item, variantId: toNumericVariantId(item.shopify_variant_id) }))
      .filter((x): x is { item: OutfitItemProp; variantId: string } => x.variantId !== null);

    if (valid.length === 0) {
      toast.error("Cannot add to cart", {
        description: "These outfit items don't have valid Shopify product IDs.",
        position: "top-center",
      });
      return;
    }

    setAddingToCart(true);
    try {
      const result = await addItemsToShopifyCart(
        valid.map((v) => ({ variantId: v.variantId, quantity: 1, name: v.item.name }))
      );

      const added = result.added || [];
      const failed = result.failed || [];
      const noIdSkipped = items.length - valid.length;

      if (added.length === 0) {
        toast.error("Couldn't add items to cart", {
          description: failed.length
            ? `Sold out: ${failed.map((f) => f.name).filter(Boolean).join(", ")}`
            : result.error || "All items unavailable",
          position: "top-center",
        });
        return;
      }

      let description = `Added ${added.length} item${added.length === 1 ? "" : "s"} to cart.`;
      if (failed.length) {
        description += failed.length === 1
          ? ` Note: ${failed[0].name} is currently sold out and was not added.`
          : ` Note: ${failed.map((f) => f.name).filter(Boolean).join(", ")} are currently sold out and were not added.`;
      } else if (noIdSkipped > 0) {
        description += ` (${noIdSkipped} skipped — no Shopify variant)`;
      }

      toast.success("Added outfit to cart", {
        description,
        position: "top-center",
        duration: failed.length ? 8000 : 6000,
        action: { label: "View Cart", onClick: () => openShopifyCart() },
      });
    } catch (error) {
      console.error('Failed to add outfit to cart:', error);
      toast.error("Failed to add items to cart", { position: "top-center" });
    } finally {
      setAddingToCart(false);
    }
  };

  // --- No outfit selected ---
  if (!outfitItems || outfitItems.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center text-center gap-4 min-h-[400px]">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <Camera className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-base">No outfit selected</h3>
        <p className="text-sm text-muted-foreground max-w-[260px]">
          Go to the <strong>Outfits</strong> tab and tap <strong>"Try On"</strong> on any look to see how it looks on you.
        </p>
      </div>
    );
  }

  const displayImage = resultImage && !showingOriginal ? resultImage : currentPhoto;
  const hasResult = !!resultImage;

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-base">Virtual Try-On</h3>
        <p className="text-xs text-muted-foreground">See how this outfit looks on you with AI</p>
      </div>

      {/* Outfit items preview */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item, idx) => (
          <div key={`${item.id ?? item.name}-${idx}`} className="flex-shrink-0 w-20">
            <div className="relative">
              <img
                src={item.imageUrl}
                alt={item.name}
                className={`w-20 h-20 rounded-md object-cover border ${swapIdx === idx ? "border-primary" : "border-border"}`}
              />
              <button
                type="button"
                aria-label={`Remove ${item.name}`}
                onClick={() => removeItem(idx)}
                disabled={isProcessing}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-background border border-border shadow flex items-center justify-center hover:bg-muted disabled:opacity-50"
              >
                <X className="h-3 w-3" />
              </button>
              <button
                type="button"
                aria-label={`Swap ${item.name}`}
                onClick={() => openSwap(idx)}
                disabled={isProcessing}
                className="absolute -bottom-1.5 -right-1.5 h-5 w-5 rounded-full bg-background border border-border shadow flex items-center justify-center hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
              <WishlistHeart wishlist={wishlist} itemId={item.id} className="absolute -bottom-1.5 -left-1.5" />
            </div>
            <p className="text-[10px] text-muted-foreground truncate mt-1">{item.name}</p>
          </div>
        ))}
      </div>

      {/* Optional swap suggestions for the selected slot */}
      {swapIdx !== null && (
        <div className="rounded-md border border-border p-2 space-y-1.5">
          <p className="text-[11px] text-muted-foreground">
            {loadingAlts ? "Finding other options..." : alternatives.length ? "Swap in another option (optional):" : "No other options available for this piece."}
          </p>
          {loadingAlts && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {!loadingAlts && alternatives.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {alternatives.map(alt => (
                <button key={alt.id} type="button" onClick={() => swapItem(alt)} className="flex-shrink-0 w-16 text-left">
                  <img src={alt.imageUrl} alt={alt.name} className="w-16 h-16 rounded-md object-cover border border-border hover:border-primary" />
                  <p className="text-[9px] text-muted-foreground truncate mt-0.5">{alt.name}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">You removed every piece — swap or go back to Outfits to pick a look.</p>
      )}

      {/* Photo upload / result area */}
      {!currentPhoto ? (
        <PhotoUpload
          brandId={brandId}
          customerToken={customerToken}
          savedPhotoUrl={customerPhotoUrl}
          onPhotoReady={handlePhotoReady}
          onPhotoCleared={handlePhotoCleared}
          onPhotoSaved={handlePhotoSaved}
        />
      ) : hasResult ? (
        /* Show AI result with toggle */
        <div className="relative">
          <img
            src={displayImage!}
            alt={showingOriginal ? "Your photo" : "Try-on result"}
            className="w-full aspect-[3/4] object-cover rounded-lg"
          />
          {!showingOriginal && (
            <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px]">
              <Sparkles className="h-3 w-3 mr-1" />
              AI Generated
            </Badge>
          )}
          <button
            onClick={() => setShowingOriginal(!showingOriginal)}
            className="absolute bottom-2 left-2 h-7 px-2.5 bg-background/80 backdrop-blur-sm rounded-full flex items-center gap-1.5 text-[11px] font-medium text-foreground border border-border/50 hover:bg-background/95 transition-colors"
          >
            <Eye className="h-3 w-3" />
            {showingOriginal ? "View Result" : "View Original"}
          </button>
        </div>
      ) : (
        /* Show the uploaded/saved photo with option to change */
        <PhotoUpload
          brandId={brandId}
          customerToken={customerToken}
          savedPhotoUrl={currentPhoto}
          onPhotoReady={handlePhotoReady}
          onPhotoCleared={handlePhotoCleared}
          onPhotoSaved={handlePhotoSaved}
        />
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Body profile indicator */}
      {bodyShape || (sizeInfo && Object.values(sizeInfo).some(v => v)) ? (
        <div className="flex items-center gap-1.5 text-xs text-primary">
          <User className="h-3 w-3" />
          <span>Personalized to your body profile</span>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Add your body shape and sizing in <strong>Account</strong> for better results
        </p>
      )}

      <div className="flex gap-2">
        <Button
          className="flex-1 gap-2"
          size="sm"
          onClick={() => generateTryOn()}
          disabled={!currentPhoto || isProcessing || items.length === 0}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {PROCESSING_MESSAGES[statusIndex]}
            </>
          ) : (
            <>
              <Camera className="h-4 w-4" />
              {dirty && hasResult ? "Update Look" : hasResult ? "Try Again" : "Try It On"}
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={handleAddAllToCart}
          disabled={addingToCart}
        >
          {addingToCart ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <ShoppingBag className="h-4 w-4" />
              Add All
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
