import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCartStore } from "@/stores/cartStore";
import { formatPrice, ShopifyProduct } from "@/lib/shopify";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingBag, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface OutfitProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category: string;
  color: string | null;
  fit: string | null;
  shopify_handle: string | null;
}

interface GeneratedOutfit {
  id: string;
  name: string;
  products: OutfitProduct[];
  totalPrice: number;
  reason: string;
  occasion: string;
}

interface RecommendedOutfitsProps {
  productTitle: string;
  productHandle: string;
  productImage: string | null;
  productCategory?: string;
  brandId?: string;
}

export function RecommendedOutfits({
  productTitle,
  productHandle,
  productImage,
  productCategory,
  brandId,
}: RecommendedOutfitsProps) {
  const [outfits, setOutfits] = useState<GeneratedOutfit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const generatedForRef = useRef<string>("");
  const addItem = useCartStore((state) => state.addItem);

  useEffect(() => {
    if (!productHandle || generatedForRef.current === productHandle) return;
    generatedForRef.current = productHandle;

    const generate = async () => {
      setIsLoading(true);
      try {
        // Fetch catalog products from the database
        let query = supabase
          .from("products")
          .select("id, name, price, image_url, category, color, fit, shopify_handle")
          .eq("inventory_status", "in_stock")
          .limit(50);

        if (brandId) {
          query = query.eq("brand_id", brandId);
        }

        const { data: catalogProducts, error } = await query;

        if (error || !catalogProducts || catalogProducts.length < 3) {
          // Not enough products to generate outfits
          setHasLoaded(true);
          setIsLoading(false);
          return;
        }

        // Find the anchor product in catalog (match by handle or name)
        const anchor = catalogProducts.find(
          (p) =>
            p.shopify_handle === productHandle ||
            p.name.toLowerCase() === productTitle.toLowerCase()
        );

        const anchorId = anchor?.id;

        // Build the product list for the AI
        const productList = catalogProducts.map((p) => ({
          id: p.id,
          name: p.name,
          price: Number(p.price),
          image_url: p.image_url,
          category: p.category,
          color: p.color,
          fit: p.fit,
        }));

        const { data, error: fnError } = await supabase.functions.invoke(
          "generate-outfits",
          {
            body: {
              products: productList,
              anchorProductId: anchorId,
              style: "versatile",
            },
          }
        );

        if (fnError) {
          console.error("Outfit generation error:", fnError);
          setHasLoaded(true);
          setIsLoading(false);
          return;
        }

        if (data?.outfits) {
          // Enrich with image URLs from catalog
          const enriched: GeneratedOutfit[] = data.outfits.map((o: any) => ({
            ...o,
            products: o.products.map((p: any) => {
              const catalogMatch = catalogProducts.find((cp) => cp.id === p.id);
              return {
                ...p,
                image_url: catalogMatch?.image_url || p.image_url,
                shopify_handle: catalogMatch?.shopify_handle || null,
              };
            }),
          }));
          setOutfits(enriched);
        }
      } catch (err) {
        console.error("Failed to generate outfit recommendations:", err);
      } finally {
        setIsLoading(false);
        setHasLoaded(true);
      }
    };

    generate();
  }, [productHandle, productTitle, brandId]);

  const handleAddAllToCart = (outfit: GeneratedOutfit) => {
    outfit.products.forEach((product) => {
      const mockShopifyProduct: ShopifyProduct = {
        node: {
          id: product.id,
          title: product.name,
          description: "",
          handle: product.shopify_handle || product.id,
          priceRange: {
            minVariantPrice: {
              amount: String(product.price),
              currencyCode: "USD",
            },
          },
          images: {
            edges: product.image_url
              ? [{ node: { url: product.image_url, altText: product.name } }]
              : [],
          },
          variants: {
            edges: [
              {
                node: {
                  id: product.id,
                  title: "Default",
                  price: { amount: String(product.price), currencyCode: "USD" },
                  availableForSale: true,
                  selectedOptions: [],
                },
              },
            ],
          },
          options: [],
        },
      };

      addItem({
        product: mockShopifyProduct,
        variantId: product.id,
        variantTitle: "Default",
        price: { amount: String(product.price), currencyCode: "USD" },
        quantity: 1,
        selectedOptions: [],
      });
    });

    toast.success(`Added "${outfit.name}" to cart`, {
      description: `${outfit.products.length} items added`,
      position: "top-center",
    });
  };

  if (!hasLoaded && !isLoading) return null;

  if (isLoading) {
    return (
      <section className="mt-12 border-t pt-10">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Complete the Look</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <div className="grid grid-cols-3 gap-2">
                  <Skeleton className="aspect-square rounded" />
                  <Skeleton className="aspect-square rounded" />
                  <Skeleton className="aspect-square rounded" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  if (outfits.length === 0) return null;

  return (
    <section className="mt-12 border-t pt-10">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">Complete the Look</h2>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {outfits.map((outfit) => (
          <Card key={outfit.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <CardContent className="p-4 space-y-3">
              <div>
                <h3 className="font-semibold text-sm">{outfit.name}</h3>
                {outfit.occasion && (
                  <p className="text-xs text-muted-foreground">
                    Perfect for: {outfit.occasion}
                  </p>
                )}
              </div>

              {/* Product thumbnails */}
              <div className="grid grid-cols-3 gap-2">
                {outfit.products.slice(0, 3).map((product) => (
                  <div
                    key={product.id}
                    className="aspect-square rounded overflow-hidden bg-muted relative group"
                  >
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                        No img
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1">
                      <span className="text-[10px] text-white leading-tight truncate">
                        {product.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {outfit.products.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{outfit.products.length - 3} more items
                </p>
              )}

              {outfit.reason && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {outfit.reason}
                </p>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="font-semibold text-sm text-primary">
                  {formatPrice(String(outfit.totalPrice), "USD")}
                </span>
                <Button
                  size="sm"
                  onClick={() => handleAddAllToCart(outfit)}
                  className="gap-1"
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Add All
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
