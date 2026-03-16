import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Loader2, Sparkles, Eye, User, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCartStore } from "@/stores/cartStore";
import { ShopifyProduct } from "@/lib/shopify";
import { toast } from "sonner";
import { PhotoUpload, getCachedPhotoUrl, setCachedPhotoUrl } from "../PhotoUpload";

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
}

export function TryOnTab({ outfitItems, customerPhotoUrl, brandId, customerToken, onPhotoSaved, bodyShape, sizeInfo }: TryOnTabProps) {
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showingOriginal, setShowingOriginal] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  const addItem = useCartStore((state) => state.addItem);

  // Auto-load: check cache first, then saved photo from account
  useEffect(() => {
    if (currentPhoto) return;
    const cached = getCachedPhotoUrl(brandId);
    if (cached) {
      setCurrentPhoto(cached);
    } else if (customerPhotoUrl) {
      setCurrentPhoto(customerPhotoUrl);
      setCachedPhotoUrl(brandId, customerPhotoUrl);
    }
  }, [customerPhotoUrl, brandId]);

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

  const generateTryOn = async () => {
    if (!currentPhoto || !outfitItems?.length) return;
    setIsProcessing(true);
    setError(null);

    try {
      const requestBody: Record<string, unknown> = {
        userImageBase64: currentPhoto,
        outfitItems: outfitItems.map(i => ({
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
    if (!outfitItems?.length) return;

    const shopifyItems = outfitItems.filter(item => {
      const vid = item.shopify_variant_id || item.id;
      return vid && vid.startsWith('gid://shopify/ProductVariant/');
    });

    if (shopifyItems.length === 0) {
      toast.error("Cannot add to cart", {
        description: "These outfit items don't have valid Shopify product IDs.",
        position: "top-center",
      });
      return;
    }

    setAddingToCart(true);
    try {
      for (const item of shopifyItems) {
        const variantId = item.shopify_variant_id || item.id!;
        const mockProduct: ShopifyProduct = {
          node: {
            id: item.id || variantId,
            title: item.name,
            description: "",
            handle: item.id || variantId,
            priceRange: {
              minVariantPrice: { amount: String(item.price || 0), currencyCode: "ZAR" },
            },
            images: {
              edges: item.imageUrl
                ? [{ node: { url: item.imageUrl, altText: item.name } }]
                : [],
            },
            variants: {
              edges: [{
                node: {
                  id: variantId,
                  title: "Default",
                  price: { amount: String(item.price || 0), currencyCode: "ZAR" },
                  availableForSale: true,
                  selectedOptions: [],
                },
              }],
            },
            options: [],
          },
        };

        await addItem({
          product: mockProduct,
          variantId,
          variantTitle: "Default",
          price: { amount: String(item.price || 0), currencyCode: "ZAR" },
          quantity: 1,
          selectedOptions: [],
        });
      }

      const skipped = outfitItems.length - shopifyItems.length;
      const msg = skipped > 0
        ? `Added ${shopifyItems.length} items (${skipped} skipped — no Shopify ID)`
        : `${shopifyItems.length} items added`;

      toast.success("Added outfit to cart", { description: msg, position: "top-center" });
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
        {outfitItems.map((item, idx) => (
          <div key={idx} className="flex-shrink-0 w-20">
            <img src={item.imageUrl} alt={item.name} className="w-20 h-20 rounded-md object-cover border border-border" />
            <p className="text-[10px] text-muted-foreground truncate mt-1">{item.name}</p>
          </div>
        ))}
      </div>

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
          onClick={generateTryOn}
          disabled={!currentPhoto || isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Camera className="h-4 w-4" />
              {hasResult ? "Try Again" : "Try It On"}
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
