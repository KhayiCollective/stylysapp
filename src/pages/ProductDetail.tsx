import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchProductByHandle, formatPrice, ShopifyProduct } from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";
import { ShopHeader } from "@/components/shop/ShopHeader";
import { ShopLayout } from "@/components/shop/ShopLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ShoppingBag, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { RecommendedOutfits } from "@/components/shop/RecommendedOutfits";

const ProductDetail = () => {
  const { handle } = useParams<{ handle: string }>();
  const [product, setProduct] = useState<ShopifyProduct['node'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  
  const addItem = useCartStore(state => state.addItem);

  useEffect(() => {
    const loadProduct = async () => {
      if (!handle) return;
      
      setIsLoading(true);
      try {
        const data = await fetchProductByHandle(handle);
        setProduct(data);
        if (data?.variants.edges[0]) {
          setSelectedVariantId(data.variants.edges[0].node.id);
        }
      } catch (error) {
        console.error("Failed to load product:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProduct();
  }, [handle]);

  const selectedVariant = product?.variants.edges.find(
    v => v.node.id === selectedVariantId
  )?.node;

  const handleAddToCart = () => {
    if (!product || !selectedVariant) return;
    
    const productWrapper: ShopifyProduct = {
      node: product
    };
    
    addItem({
      product: productWrapper,
      variantId: selectedVariant.id,
      variantTitle: selectedVariant.title,
      price: selectedVariant.price,
      quantity,
      selectedOptions: selectedVariant.selectedOptions || [],
    });
    
    toast.success("Added to cart", {
      description: `${product.title} × ${quantity}`,
      position: "top-center",
    });
  };

  if (isLoading) {
    return (
      <ShopLayout>
        <div className="min-h-screen bg-background">
          <ShopHeader />
          <main className="container mx-auto px-4 py-8">
            <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
              <Skeleton className="aspect-square rounded-lg" />
              <div className="space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-6 w-1/4" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </main>
        </div>
      </ShopLayout>
    );
  }

  if (!product) {
    return (
      <ShopLayout>
        <div className="min-h-screen bg-background">
          <ShopHeader />
          <main className="container mx-auto px-4 py-16 text-center">
            <p className="text-muted-foreground text-lg">Product not found</p>
            <Button asChild className="mt-4">
              <Link to="/shop">Back to Shop</Link>
            </Button>
          </main>
        </div>
      </ShopLayout>
    );
  }

  const images = product.images.edges;

  return (
    <ShopLayout>
      <div className="min-h-screen bg-background">
        <ShopHeader />
        
        <main className="container mx-auto px-4 py-8">
          <Button variant="ghost" asChild className="mb-6">
            <Link to="/shop">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Shop
            </Link>
          </Button>
          
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {/* Image Gallery */}
            <div className="space-y-4">
              <div className="aspect-square overflow-hidden rounded-lg bg-muted">
                {images[selectedImage] ? (
                  <img
                    src={images[selectedImage].node.url}
                    alt={images[selectedImage].node.altText || product.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    No image
                  </div>
                )}
              </div>
              
              {images.length > 1 && (
                <div className="grid grid-cols-5 gap-2">
                  {images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      className={`aspect-square rounded-md overflow-hidden border-2 transition-colors ${
                        selectedImage === index 
                          ? "border-primary" 
                          : "border-transparent hover:border-muted-foreground/50"
                      }`}
                    >
                      <img
                        src={image.node.url}
                        alt={image.node.altText || `${product.title} ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Product Info */}
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold mb-2">{product.title}</h1>
                <p className="text-2xl font-semibold text-primary">
                  {selectedVariant && formatPrice(selectedVariant.price.amount, selectedVariant.price.currencyCode)}
                </p>
              </div>
              
              {product.description && (
                <p className="text-muted-foreground leading-relaxed">
                  {product.description}
                </p>
              )}
              
              {/* Variant Selection */}
              {product.variants.edges.length > 1 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {product.options[0]?.name || "Option"}
                  </label>
                  <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {product.variants.edges.map((variant) => (
                        <SelectItem 
                          key={variant.node.id} 
                          value={variant.node.id}
                          disabled={!variant.node.availableForSale}
                        >
                          {variant.node.title}
                          {!variant.node.availableForSale && " (Out of Stock)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {/* Quantity */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Quantity</label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center font-medium">{quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Add to Cart */}
              <Button 
                onClick={handleAddToCart}
                size="lg"
                className="w-full"
                disabled={!selectedVariant?.availableForSale}
              >
                <ShoppingBag className="h-5 w-5 mr-2" />
                {selectedVariant?.availableForSale ? "Add to Cart" : "Out of Stock"}
              </Button>
            </div>
          </div>

          {/* Complete the Look - AI Outfit Recommendations */}
          <RecommendedOutfits
            productTitle={product.title}
            productHandle={product.handle}
            productImage={images[0]?.node.url || null}
            productCategory={product.options?.[0]?.values?.[0]}
          />
        </main>
      </div>
    </ShopLayout>
  );
};

export default ProductDetail;
