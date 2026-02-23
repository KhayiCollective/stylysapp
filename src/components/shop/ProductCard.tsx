import { Link } from "react-router-dom";
import { ShopifyProduct, formatPrice } from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";
import { useWidgetControl } from "./ShopLayout";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface ProductCardProps {
  product: ShopifyProduct;
}

export const ProductCard = ({ product }: ProductCardProps) => {
  const addItem = useCartStore(state => state.addItem);
  const { buildOutfitAround } = useWidgetControl();
  const { node } = product;
  
  const firstImage = node.images.edges[0]?.node;
  const firstVariant = node.variants.edges[0]?.node;
  const price = node.priceRange.minVariantPrice;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!firstVariant) return;
    
    addItem({
      product,
      variantId: firstVariant.id,
      variantTitle: firstVariant.title,
      price: firstVariant.price,
      quantity: 1,
      selectedOptions: firstVariant.selectedOptions || [],
    });
    
    toast.success("Added to cart", {
      description: node.title,
      position: "top-center",
    });
  };

  const handleBuildOutfit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    buildOutfitAround(node.id, node.title);
  };

  return (
    <Link 
      to={`/shop/product/${node.handle}`}
      className="group block"
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-muted mb-3">
        {firstImage ? (
          <img
            src={firstImage.url}
            alt={firstImage.altText || node.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            No image
          </div>
        )}
        
        <div className="absolute inset-x-0 bottom-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex gap-2">
          <Button 
            onClick={handleBuildOutfit}
            variant="secondary"
            size="sm"
            className="flex-1 gap-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Style Me
          </Button>
          <Button 
            onClick={handleAddToCart}
            size="sm"
            className="flex-1 gap-1"
            disabled={!firstVariant?.availableForSale}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            {firstVariant?.availableForSale ? "Add" : "Out of Stock"}
          </Button>
        </div>
      </div>
      
      <div className="space-y-1">
        <h3 className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
          {node.title}
        </h3>
        <p className="text-sm text-muted-foreground">
          {formatPrice(price.amount, price.currencyCode)}
        </p>
      </div>
    </Link>
  );
};
