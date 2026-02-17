import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wand2, Check, RefreshCw, Heart, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { VirtualTryOn } from "@/components/VirtualTryOn";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
  name?: string;
  items: Product[];
  totalPrice: number;
  reason?: string;
  occasion?: string;
}

const OutfitGenerator = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedAnchor, setSelectedAnchor] = useState<Product | null>(null);
  const [generatedOutfits, setGeneratedOutfits] = useState<Outfit[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [tryOnProduct, setTryOnProduct] = useState<Product | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    async function fetchProducts() {
      setLoadingProducts(true);
      const { data: profile } = await supabase
        .from("profiles")
        .select("brand_id")
        .eq("id", user?.id ?? "")
        .single();

      if (!profile?.brand_id) { setLoadingProducts(false); return; }

      const { data } = await supabase
        .from("products")
        .select("id, name, image_url, category, color, fit, price")
        .eq("brand_id", profile.brand_id)
        .eq("inventory_status", "in_stock")
        .limit(50);

      setProducts((data || []).map(p => ({
        id: p.id,
        name: p.name,
        imageUrl: p.image_url || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=500&fit=crop",
        category: p.category,
        color: p.color || "unknown",
        fit: p.fit || "regular",
        price: Number(p.price),
      })));
      setLoadingProducts(false);
    }
    if (user) fetchProducts();
  }, [user]);

  const handleSaveOutfit = (outfit: Outfit) => {
    toast({ title: "Outfit saved!", description: "Added to your wishlist." });
  };

  const generateOutfits = async () => {
    if (!selectedAnchor) {
      toast({ title: "Select an anchor product", description: "Choose a product to build outfits around.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-outfits", {
        body: {
          products: products.map(p => ({
            id: p.id, name: p.name, price: p.price, image_url: p.imageUrl,
            category: p.category, color: p.color, fit: p.fit,
          })),
          anchorProductId: selectedAnchor.id,
        },
      });

      if (error) throw error;

      const outfits: Outfit[] = (data.outfits || []).map((o: any) => ({
        id: o.id,
        name: o.name,
        items: (o.products || o.items || []).map((p: any) => ({
          id: p.id, name: p.name, price: Number(p.price),
          imageUrl: p.image_url || p.imageUrl || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=500&fit=crop",
          category: p.category, color: p.color || "unknown", fit: p.fit || "regular",
        })),
        totalPrice: o.totalPrice,
        reason: o.reason,
        occasion: o.occasion,
      }));

      setGeneratedOutfits(outfits);
      toast({ title: "Outfits generated!", description: `Created ${outfits.length} outfit combinations.` });
    } catch (err: any) {
      console.error("Outfit generation error:", err);
      toast({ title: "Generation failed", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <DashboardLayout title="Outfit Generator" description="Select an anchor product and generate complete outfits">
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-10">
          {/* Anchor Selection */}
          <div>
            <h2 className="font-display text-xl mb-4">1. Select Anchor Product</h2>
            <p className="text-muted-foreground mb-6">Choose the main product to build outfits around.</p>

            {loadingProducts ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading catalog...</span>
              </div>
            ) : products.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No products synced yet. Sync your catalog first from the Catalog page.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {products.map((product) => (
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
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
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
            )}
          </div>

          {/* Generate Button */}
          <div className="flex justify-center">
            <Button
              variant="editorial"
              size="xl"
              onClick={generateOutfits}
              disabled={!selectedAnchor || isGenerating || products.length === 0}
              className="min-w-[200px]"
            >
              {isGenerating ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Generating...</>
              ) : (
                <><Wand2 className="w-4 h-4 mr-2" />Generate Outfits</>
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
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {generatedOutfits.map((outfit, index) => (
                  <Card key={outfit.id} className="card-editorial overflow-hidden">
                    <div className="p-4 border-b border-border/50">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary">{outfit.name || `Outfit ${index + 1}`}</Badge>
                        <span className="font-display text-lg font-medium">${outfit.totalPrice.toFixed(2)}</span>
                      </div>
                      {outfit.occasion && <p className="text-xs text-muted-foreground mt-1">{outfit.occasion}</p>}
                    </div>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 gap-3">
                        {outfit.items.map((item) => (
                          <div key={item.id} className="relative cursor-pointer group/item" onClick={() => setTryOnProduct(item)}>
                            <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover/item:scale-105 transition-transform" />
                            </div>
                            {item.id === selectedAnchor?.id && (
                              <Badge className="absolute top-1 left-1 text-[10px] bg-foreground text-background">Anchor</Badge>
                            )}
                            <p className="text-xs mt-1 truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">${item.price}</p>
                          </div>
                        ))}
                      </div>
                      {outfit.reason && <p className="text-xs text-muted-foreground mt-3 italic">{outfit.reason}</p>}
                    </CardContent>
                    <div className="p-4 border-t border-border/50">
                      <Button variant="editorial-outline" className="w-full" size="sm" onClick={() => handleSaveOutfit(outfit)}>
                        <Heart className="w-4 h-4 mr-2" />Save Outfit
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Virtual Try-On Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <VirtualTryOn productImage={tryOnProduct?.imageUrl} productName={tryOnProduct?.name} />
            {!tryOnProduct && generatedOutfits.length > 0 && (
              <p className="text-xs text-muted-foreground text-center mt-3">Click any item above to try it on virtually</p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default OutfitGenerator;
