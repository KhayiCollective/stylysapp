import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Camera, ExternalLink, Loader2 } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import { useWidgetControl } from "./ShopLayout";
import { ShopifyProduct } from "@/lib/shopify";
import { toast } from "sonner";
import type { ChatProduct } from "./StylingChatbot";

interface ChatProductCardProps {
  product: ChatProduct;
}

export function ChatProductCard({ product }: ChatProductCardProps) {
  const [addingToCart, setAddingToCart] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const { buildOutfitAround } = useWidgetControl();

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!product.variantId) {
      toast.error("Cannot add to cart", {
        description: "This product doesn't have a valid variant ID.",
        position: "top-center",
      });
      return;
    }

    setAddingToCart(true);
    try {
      const mockProduct: ShopifyProduct = {
        node: {
          id: product.variantId,
          title: product.name,
          description: "",
          handle: product.handle || "",
          priceRange: {
            minVariantPrice: { amount: String(product.price), currencyCode: "ZAR" },
          },
          images: {
            edges: product.image
              ? [{ node: { url: product.image, altText: product.name } }]
              : [],
          },
          variants: {
            edges: [{
              node: {
                id: product.variantId,
                title: "Default",
                price: { amount: String(product.price), currencyCode: "ZAR" },
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
        variantId: product.variantId,
        variantTitle: "Default",
        price: { amount: String(product.price), currencyCode: "ZAR" },
        quantity: 1,
        selectedOptions: [],
      });

      toast.success("Added to cart", {
        description: product.name,
        position: "top-center",
      });
    } catch (error) {
      console.error("Failed to add to cart:", error);
      toast.error("Failed to add to cart", { position: "top-center" });
    } finally {
      setAddingToCart(false);
    }
  };

  const handleTryOn = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.variantId) {
      buildOutfitAround(product.variantId, product.name);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {product.image && (
        <div className="aspect-square w-full overflow-hidden">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{product.name}</p>
            {product.category && (
              <p className="text-[11px] text-muted-foreground capitalize">{product.category}</p>
            )}
          </div>
          <span className="font-semibold text-sm shrink-0">
            R{product.price.toFixed(2)}
          </span>
        </div>
        <div className="flex gap-1.5">
          {product.handle && (
            <Link to={`/shop/product/${product.handle}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full text-xs h-8 gap-1">
                <ExternalLink className="h-3 w-3" />
                View
              </Button>
            </Link>
          )}
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-8 gap-1"
            onClick={handleTryOn}
            disabled={!product.variantId}
          >
            <Camera className="h-3 w-3" />
            Try On
          </Button>
          <Button
            size="sm"
            className="flex-1 text-xs h-8 gap-1"
            onClick={handleAddToCart}
            disabled={addingToCart || !product.variantId}
          >
            {addingToCart ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ShoppingBag className="h-3 w-3" />
            )}
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
