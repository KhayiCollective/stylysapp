import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ShoppingBag, ArrowLeft, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
}

interface Outfit {
  id: string;
  items: Product[];
  totalPrice: number;
}

// Mock anchor product (the product being viewed)
const anchorProduct: Product = {
  id: "anchor",
  name: "Silk Midi Dress",
  imageUrl: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&h=800&fit=crop",
  price: 189.00
};

// Mock generated outfits
const mockOutfits: Outfit[] = [
  {
    id: "1",
    items: [
      anchorProduct,
      { id: "2", name: "Leather Belt", imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=500&fit=crop", price: 79.00 },
      { id: "3", name: "Strappy Heels", imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&h=500&fit=crop", price: 149.00 },
    ],
    totalPrice: 417.00
  },
  {
    id: "2",
    items: [
      anchorProduct,
      { id: "4", name: "Cropped Cardigan", imageUrl: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400&h=500&fit=crop", price: 119.00 },
      { id: "5", name: "Ankle Boots", imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&h=500&fit=crop", price: 189.00 },
    ],
    totalPrice: 497.00
  },
  {
    id: "3",
    items: [
      anchorProduct,
      { id: "6", name: "Structured Blazer", imageUrl: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=500&fit=crop", price: 229.00 },
      { id: "7", name: "Pointed Flats", imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&h=500&fit=crop", price: 99.00 },
    ],
    totalPrice: 517.00
  },
];

const Widget = () => {
  const [selectedOutfit, setSelectedOutfit] = useState<Outfit | null>(null);
  const { toast } = useToast();

  const handleAddToCart = (outfit: Outfit) => {
    toast({
      title: "Added to cart!",
      description: `${outfit.items.length} items added to your cart. Total: $${outfit.totalPrice.toFixed(2)}`
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="editorial-container flex items-center justify-between h-14">
          <Link to="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Dashboard</span>
          </Link>
          <Badge variant="secondary">Widget Demo</Badge>
        </div>
      </header>

      <div className="editorial-container py-8">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Product Display */}
          <div>
            <div className="aspect-[3/4] rounded-lg overflow-hidden bg-muted mb-6">
              <img 
                src={anchorProduct.imageUrl} 
                alt={anchorProduct.name}
                className="w-full h-full object-cover"
              />
            </div>
            <h1 className="font-display text-3xl font-medium mb-2">{anchorProduct.name}</h1>
            <p className="text-2xl font-medium">${anchorProduct.price.toFixed(2)}</p>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              A timeless silk midi dress with a flattering silhouette. Perfect for both 
              office and evening occasions. Pair with our curated outfit suggestions below.
            </p>
            <Button variant="editorial" size="lg" className="mt-6">
              <ShoppingBag className="w-4 h-4 mr-2" />
              Add to Cart
            </Button>
          </div>

          {/* Complete the Look Widget */}
          <div>
            <Card className="card-editorial overflow-hidden">
              <div className="bg-foreground text-background p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5" />
                  <span className="uppercase tracking-widest text-xs font-semibold">AI Styled</span>
                </div>
                <h2 className="font-display text-2xl font-medium">Complete the Look</h2>
                <p className="text-background/70 mt-1 text-sm">
                  Curated outfit combinations that pair perfectly with your selection
                </p>
              </div>

              <CardContent className="p-6">
                <div className="space-y-6">
                  {mockOutfits.map((outfit, index) => (
                    <div 
                      key={outfit.id}
                      onClick={() => setSelectedOutfit(selectedOutfit?.id === outfit.id ? null : outfit)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedOutfit?.id === outfit.id 
                          ? "border-foreground bg-muted/50" 
                          : "border-border hover:border-foreground/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <Badge variant="secondary">Look {index + 1}</Badge>
                        <div className="flex items-center gap-2">
                          <span className="font-display text-lg font-medium">
                            ${outfit.totalPrice.toFixed(2)}
                          </span>
                          {selectedOutfit?.id === outfit.id && (
                            <div className="w-5 h-5 bg-foreground rounded-full flex items-center justify-center">
                              <Check className="w-3 h-3 text-background" />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-3">
                        {outfit.items.map((item) => (
                          <div key={item.id} className="flex-1">
                            <div className="aspect-square rounded-md overflow-hidden bg-muted mb-2">
                              <img 
                                src={item.imageUrl} 
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <p className="text-xs truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">${item.price}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {selectedOutfit && (
                  <div className="mt-6 pt-6 border-t border-border">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Complete Outfit Total</p>
                        <p className="font-display text-2xl font-medium">
                          ${selectedOutfit.totalPrice.toFixed(2)}
                        </p>
                      </div>
                      <Badge className="bg-success/10 text-success border-success/20">
                        Save 15%
                      </Badge>
                    </div>
                    <Button 
                      variant="editorial" 
                      size="lg" 
                      className="w-full"
                      onClick={() => handleAddToCart(selectedOutfit)}
                    >
                      <ShoppingBag className="w-4 h-4 mr-2" />
                      Add Outfit to Cart
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Integration Note */}
            <Card className="mt-6 border-dashed">
              <CardContent className="py-4">
                <p className="text-sm text-muted-foreground text-center">
                  This widget can be embedded on any product page to drive cross-sells and increase AOV.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Widget;
