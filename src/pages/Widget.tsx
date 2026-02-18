import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ShoppingBag, ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Product {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  category: string;
}

interface Outfit {
  id: string;
  name?: string;
  items: Product[];
  totalPrice: number;
}

const Widget = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [anchorProduct, setAnchorProduct] = useState<Product | null>(null);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [generatingOutfits, setGeneratingOutfits] = useState(false);
  const [selectedOutfit, setSelectedOutfit] = useState<Outfit | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: profile } = await supabase
        .from("profiles")
        .select("brand_id")
        .eq("id", user?.id ?? "")
        .single();

      if (!profile?.brand_id) { setLoading(false); return; }

      const { data } = await supabase
        .from("products")
        .select("id, name, image_url, price, category")
        .eq("brand_id", profile.brand_id)
        .eq("inventory_status", "in_stock")
        .limit(20);

      const mapped = (data || []).map(p => ({
        id: p.id,
        name: p.name,
        imageUrl: p.image_url || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=800&fit=crop",
        price: Number(p.price),
        category: p.category,
      }));
      setProducts(mapped);
      if (mapped.length > 0) {
        setAnchorProduct(mapped[0]);
      }
      setLoading(false);
    }
    if (user) load();
  }, [user]);

  useEffect(() => {
    if (!anchorProduct || products.length < 2) return;
    generateOutfits();
  }, [anchorProduct]);

  const generateOutfits = async () => {
    if (!anchorProduct) return;
    setGeneratingOutfits(true);
    setSelectedOutfit(null);
    try {
      // Fetch composition rules
      let compositionRules = undefined;
      const { data: rulesData } = await supabase
        .from("rules")
        .select("config, enabled")
        .eq("category", "composition")
        .single();
      
      if (rulesData?.enabled && rulesData.config) {
        compositionRules = rulesData.config;
      }

      const { data, error } = await supabase.functions.invoke("generate-outfits", {
        body: {
          products: products.map(p => ({
            id: p.id, name: p.name, price: p.price,
            image_url: p.imageUrl, category: p.category, color: null, fit: null,
          })),
          anchorProductId: anchorProduct.id,
          rules: compositionRules,
        },
      });
      if (error) throw error;
      setOutfits((data.outfits || []).map((o: any) => ({
        id: o.id,
        name: o.name,
        items: (o.products || o.items || []).map((p: any) => ({
          id: p.id, name: p.name, price: Number(p.price),
          imageUrl: p.image_url || p.imageUrl || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=500&fit=crop",
          category: p.category,
        })),
        totalPrice: o.totalPrice,
      })));
    } catch (err: any) {
      console.error("Widget outfit generation error:", err);
      toast({ title: "Failed to generate outfits", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingOutfits(false);
    }
  };

  const handleAddToCart = (outfit: Outfit) => {
    toast({
      title: "Added to cart!",
      description: `${outfit.items.length} items added. Total: $${outfit.totalPrice.toFixed(2)}`,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border">
          <div className="editorial-container flex items-center justify-between h-14">
            <Link to="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" /><span className="text-sm">Back to Dashboard</span>
            </Link>
            <Badge variant="secondary">Widget Demo</Badge>
          </div>
        </header>
        <div className="editorial-container py-16 text-center">
          <p className="text-muted-foreground">No products synced yet. Go to the Catalog page to sync your products first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="editorial-container flex items-center justify-between h-14">
          <Link to="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /><span className="text-sm">Back to Dashboard</span>
          </Link>
          <Badge variant="secondary">Widget Demo</Badge>
        </div>
      </header>

      <div className="editorial-container py-8">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Product Display */}
          <div>
            <div className="aspect-[3/4] rounded-lg overflow-hidden bg-muted mb-6">
              <img src={anchorProduct!.imageUrl} alt={anchorProduct!.name} className="w-full h-full object-cover" />
            </div>
            <h1 className="font-display text-3xl font-medium mb-2">{anchorProduct!.name}</h1>
            <p className="text-2xl font-medium">${anchorProduct!.price.toFixed(2)}</p>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              Pair with our AI-curated outfit suggestions below.
            </p>
            <Button variant="editorial" size="lg" className="mt-6">
              <ShoppingBag className="w-4 h-4 mr-2" />Add to Cart
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
                <p className="text-background/70 mt-1 text-sm">Curated outfit combinations for your selection</p>
              </div>

              <CardContent className="p-6">
                {generatingOutfits ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
                    <span className="text-sm text-muted-foreground">Generating outfits...</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {outfits.map((outfit, index) => (
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
                          <Badge variant="secondary">{outfit.name || `Look ${index + 1}`}</Badge>
                          <div className="flex items-center gap-2">
                            <span className="font-display text-lg font-medium">${outfit.totalPrice.toFixed(2)}</span>
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
                                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                              </div>
                              <p className="text-xs truncate">{item.name}</p>
                              <p className="text-xs text-muted-foreground">${item.price}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedOutfit && (
                  <div className="mt-6 pt-6 border-t border-border">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Complete Outfit Total</p>
                        <p className="font-display text-2xl font-medium">${selectedOutfit.totalPrice.toFixed(2)}</p>
                      </div>
                      <Badge className="bg-success/10 text-success border-success/20">Save 15%</Badge>
                    </div>
                    <Button variant="editorial" size="lg" className="w-full" onClick={() => handleAddToCart(selectedOutfit)}>
                      <ShoppingBag className="w-4 h-4 mr-2" />Add Outfit to Cart
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

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
