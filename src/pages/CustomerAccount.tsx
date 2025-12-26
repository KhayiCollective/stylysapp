import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, ShoppingBag, Trash2, Share2, ArrowLeft, User, Package } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface OutfitItem {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
}

interface SavedOutfit {
  id: string;
  name: string;
  items: OutfitItem[];
  totalPrice: number;
  savedAt: string;
}

// Mock data - in production this would come from the database
const mockSavedOutfits: SavedOutfit[] = [
  {
    id: "1",
    name: "Weekend Brunch Look",
    items: [
      { id: "p1", name: "Linen Blouse", imageUrl: "https://images.unsplash.com/photo-1598554747436-c9293d6a588f?w=400", price: 89 },
      { id: "p2", name: "Wide Leg Pants", imageUrl: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400", price: 129 },
      { id: "p3", name: "Leather Sandals", imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400", price: 79 },
    ],
    totalPrice: 297,
    savedAt: "2024-01-15",
  },
  {
    id: "2",
    name: "Office Power Outfit",
    items: [
      { id: "p4", name: "Tailored Blazer", imageUrl: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400", price: 249 },
      { id: "p5", name: "Silk Shirt", imageUrl: "https://images.unsplash.com/photo-1598554747436-c9293d6a588f?w=400", price: 159 },
      { id: "p6", name: "Pencil Skirt", imageUrl: "https://images.unsplash.com/photo-1583496661160-fb5886a0uj75?w=400", price: 119 },
      { id: "p7", name: "Pointed Heels", imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400", price: 189 },
    ],
    totalPrice: 716,
    savedAt: "2024-01-18",
  },
  {
    id: "3",
    name: "Date Night Ensemble",
    items: [
      { id: "p8", name: "Little Black Dress", imageUrl: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400", price: 199 },
      { id: "p9", name: "Statement Earrings", imageUrl: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400", price: 59 },
      { id: "p10", name: "Clutch Bag", imageUrl: "https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=400", price: 129 },
    ],
    totalPrice: 387,
    savedAt: "2024-01-20",
  },
];

const CustomerAccount = () => {
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>(mockSavedOutfits);
  const { toast } = useToast();

  const handleRemove = (outfitId: string) => {
    setSavedOutfits((prev) => prev.filter((o) => o.id !== outfitId));
    toast({
      title: "Outfit removed",
      description: "The outfit has been removed from your saved items.",
    });
  };

  const handleAddToCart = (outfit: SavedOutfit) => {
    toast({
      title: "Added to cart",
      description: `${outfit.items.length} items from "${outfit.name}" added to your cart.`,
    });
  };

  const handleShare = (outfit: SavedOutfit) => {
    navigator.clipboard.writeText(`${window.location.origin}/outfit/${outfit.id}`);
    toast({
      title: "Link copied",
      description: "Share link has been copied to your clipboard.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-40">
        <div className="editorial-container flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Continue Shopping</span>
          </Link>
          <h1 className="font-display text-lg font-medium">My Account</h1>
          <div className="w-24" />
        </div>
      </header>

      <main className="editorial-container py-8">
        <div className="max-w-4xl mx-auto">
          {/* Account Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-medium">Welcome back</h2>
              <p className="text-muted-foreground">Manage your saved outfits and orders</p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="outfits" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="outfits" className="gap-2">
                <Heart className="h-4 w-4" />
                Saved Outfits
              </TabsTrigger>
              <TabsTrigger value="orders" className="gap-2">
                <Package className="h-4 w-4" />
                Orders
              </TabsTrigger>
            </TabsList>

            {/* Saved Outfits Tab */}
            <TabsContent value="outfits" className="space-y-6">
              {savedOutfits.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-16 text-center">
                    <Heart className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                    <h3 className="font-display text-xl font-medium mb-2">No saved outfits</h3>
                    <p className="text-muted-foreground mb-6">
                      Start browsing and save outfits you love to see them here
                    </p>
                    <Button asChild>
                      <Link to="/">Start Shopping</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6 md:grid-cols-2">
                  {savedOutfits.map((outfit) => (
                    <Card key={outfit.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{outfit.name}</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                              {outfit.items.length} items • Saved {new Date(outfit.savedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge variant="secondary" className="font-display text-lg">
                            ${outfit.totalPrice}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Product Grid */}
                        <div className="grid grid-cols-4 gap-2">
                          {outfit.items.map((item) => (
                            <div key={item.id} className="space-y-1">
                              <div className="aspect-square rounded-md overflow-hidden bg-muted">
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

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="default"
                            className="flex-1"
                            onClick={() => handleAddToCart(outfit)}
                          >
                            <ShoppingBag className="h-4 w-4 mr-2" />
                            Add All to Cart
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleShare(outfit)}
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleRemove(outfit.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Orders Tab */}
            <TabsContent value="orders">
              <Card className="border-dashed">
                <CardContent className="py-16 text-center">
                  <Package className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="font-display text-xl font-medium mb-2">No orders yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Your order history will appear here once you make a purchase
                  </p>
                  <Button asChild>
                    <Link to="/">Start Shopping</Link>
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default CustomerAccount;
