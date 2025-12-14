import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wand2, Check, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  imageUrl: string;
  category: string;
  color: string;
  fit: string;
  price: number;
}

interface Outfit {
  id: string;
  items: Product[];
  totalPrice: number;
}

// Mock products for outfit generation
const mockProducts: Product[] = [
  { id: "1", name: "Classic White Tee", imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=500&fit=crop", category: "tops", color: "white", fit: "relaxed", price: 29.00 },
  { id: "2", name: "High-Waisted Jeans", imageUrl: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400&h=500&fit=crop", category: "bottoms", color: "blue", fit: "fitted", price: 89.00 },
  { id: "3", name: "Wool Overcoat", imageUrl: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=400&h=500&fit=crop", category: "outerwear", color: "camel", fit: "oversized", price: 249.00 },
  { id: "4", name: "Leather Boots", imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=500&fit=crop", category: "footwear", color: "brown", fit: "fitted", price: 179.00 },
  { id: "5", name: "Silk Blouse", imageUrl: "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=400&h=500&fit=crop", category: "tops", color: "cream", fit: "relaxed", price: 129.00 },
  { id: "6", name: "Tailored Trousers", imageUrl: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=500&fit=crop", category: "bottoms", color: "black", fit: "fitted", price: 119.00 },
  { id: "7", name: "Cashmere Sweater", imageUrl: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&h=500&fit=crop", category: "tops", color: "grey", fit: "relaxed", price: 189.00 },
  { id: "8", name: "Linen Blazer", imageUrl: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=500&fit=crop", category: "outerwear", color: "navy", fit: "fitted", price: 199.00 },
];

const OutfitGenerator = () => {
  const [selectedAnchor, setSelectedAnchor] = useState<Product | null>(null);
  const [generatedOutfits, setGeneratedOutfits] = useState<Outfit[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const generateOutfits = () => {
    if (!selectedAnchor) {
      toast({ 
        title: "Select an anchor product", 
        description: "Choose a product to build outfits around.",
        variant: "destructive" 
      });
      return;
    }

    setIsGenerating(true);

    // Simulate AI generation with rule-based logic
    setTimeout(() => {
      const outfits: Outfit[] = [];
      const otherProducts = mockProducts.filter(p => p.id !== selectedAnchor.id);

      // Generate 3 different outfit combinations
      for (let i = 0; i < 3; i++) {
        const items: Product[] = [selectedAnchor];
        
        // Add complementary items based on category
        const categories = ["tops", "bottoms", "outerwear", "footwear"];
        const anchorCategory = selectedAnchor.category;
        
        categories.forEach(cat => {
          if (cat !== anchorCategory) {
            const available = otherProducts.filter(p => 
              p.category === cat && !items.find(item => item.id === p.id)
            );
            if (available.length > 0) {
              const randomIndex = (i + Math.floor(Math.random() * available.length)) % available.length;
              items.push(available[randomIndex]);
            }
          }
        });

        // Limit to 4 items max
        const outfitItems = items.slice(0, 4);
        const totalPrice = outfitItems.reduce((sum, item) => sum + item.price, 0);

        outfits.push({
          id: `outfit-${i + 1}`,
          items: outfitItems,
          totalPrice
        });
      }

      setGeneratedOutfits(outfits);
      setIsGenerating(false);
      toast({ 
        title: "Outfits generated!", 
        description: `Created ${outfits.length} outfit combinations.` 
      });
    }, 1500);
  };

  return (
    <DashboardLayout 
      title="Outfit Generator" 
      description="Select an anchor product and generate complete outfits"
    >
      {/* Anchor Selection */}
      <div className="mb-10">
        <h2 className="font-display text-xl mb-4">1. Select Anchor Product</h2>
        <p className="text-muted-foreground mb-6">Choose the main product to build outfits around.</p>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {mockProducts.map((product) => (
            <div
              key={product.id}
              onClick={() => setSelectedAnchor(product)}
              className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                selectedAnchor?.id === product.id 
                  ? "border-foreground ring-2 ring-foreground/20" 
                  : "border-transparent hover:border-border"
              }`}
            >
              <div className="aspect-[3/4] bg-muted">
                <img 
                  src={product.imageUrl} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
              {selectedAnchor?.id === product.id && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-foreground rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-background" />
                </div>
              )}
              <div className="p-2">
                <p className="text-xs font-medium truncate">{product.name}</p>
                <p className="text-xs text-muted-foreground">${product.price}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <div className="flex justify-center mb-10">
        <Button 
          variant="editorial" 
          size="xl" 
          onClick={generateOutfits}
          disabled={!selectedAnchor || isGenerating}
          className="min-w-[200px]"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 mr-2" />
              Generate Outfits
            </>
          )}
        </Button>
      </div>

      {/* Generated Outfits */}
      {generatedOutfits.length > 0 && (
        <div>
          <h2 className="font-display text-xl mb-4">2. Generated Outfits</h2>
          <p className="text-muted-foreground mb-6">
            {generatedOutfits.length} outfit combinations based on {selectedAnchor?.name}
          </p>

          <div className="grid gap-8 md:grid-cols-3">
            {generatedOutfits.map((outfit, index) => (
              <Card key={outfit.id} className="card-editorial overflow-hidden">
                <div className="p-4 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">Outfit {index + 1}</Badge>
                    <span className="font-display text-lg font-medium">
                      ${outfit.totalPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-3">
                    {outfit.items.map((item) => (
                      <div key={item.id} className="relative">
                        <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                          <img 
                            src={item.imageUrl} 
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {item.id === selectedAnchor?.id && (
                          <Badge className="absolute top-1 left-1 text-[10px] bg-foreground text-background">
                            Anchor
                          </Badge>
                        )}
                        <p className="text-xs mt-1 truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">${item.price}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <div className="p-4 border-t border-border/50">
                  <Button variant="editorial-outline" className="w-full" size="sm">
                    Save Outfit
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default OutfitGenerator;
