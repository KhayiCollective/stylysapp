import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, ShoppingCart, Trash2, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SavedOutfit {
  id: string;
  name: string;
  items: {
    id: string;
    name: string;
    imageUrl: string;
    price: number;
  }[];
  totalPrice: number;
  savedAt: Date;
}

// Mock saved outfits
const mockSavedOutfits: SavedOutfit[] = [
  {
    id: "1",
    name: "Casual Weekend Look",
    items: [
      { id: "1", name: "Classic White Tee", imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=500&fit=crop", price: 29.00 },
      { id: "2", name: "High-Waisted Jeans", imageUrl: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400&h=500&fit=crop", price: 89.00 },
      { id: "4", name: "Leather Boots", imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=500&fit=crop", price: 179.00 },
    ],
    totalPrice: 297.00,
    savedAt: new Date("2024-12-20"),
  },
  {
    id: "2",
    name: "Office Ready",
    items: [
      { id: "5", name: "Silk Blouse", imageUrl: "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=400&h=500&fit=crop", price: 129.00 },
      { id: "6", name: "Tailored Trousers", imageUrl: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=500&fit=crop", price: 119.00 },
      { id: "8", name: "Linen Blazer", imageUrl: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=500&fit=crop", price: 199.00 },
    ],
    totalPrice: 447.00,
    savedAt: new Date("2024-12-19"),
  },
  {
    id: "3",
    name: "Winter Cozy",
    items: [
      { id: "7", name: "Cashmere Sweater", imageUrl: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&h=500&fit=crop", price: 189.00 },
      { id: "2", name: "High-Waisted Jeans", imageUrl: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400&h=500&fit=crop", price: 89.00 },
      { id: "3", name: "Wool Overcoat", imageUrl: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=400&h=500&fit=crop", price: 249.00 },
      { id: "4", name: "Leather Boots", imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=500&fit=crop", price: 179.00 },
    ],
    totalPrice: 706.00,
    savedAt: new Date("2024-12-18"),
  },
];

const Wishlist = () => {
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>(mockSavedOutfits);
  const { toast } = useToast();

  const handleRemove = (outfitId: string) => {
    setSavedOutfits(savedOutfits.filter(o => o.id !== outfitId));
    toast({
      title: "Outfit removed",
      description: "The outfit has been removed from your wishlist.",
    });
  };

  const handleAddToCart = (outfit: SavedOutfit) => {
    toast({
      title: "Added to cart",
      description: `${outfit.items.length} items added to cart.`,
    });
  };

  const handleShare = (outfit: SavedOutfit) => {
    navigator.clipboard.writeText(`Check out this outfit: ${outfit.name}`);
    toast({
      title: "Link copied",
      description: "Outfit link copied to clipboard.",
    });
  };

  return (
    <DashboardLayout
      title="Saved Outfits"
      description="Your wishlist of curated outfit combinations"
    >
      {savedOutfits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Heart className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="font-display text-xl font-medium mb-2">No saved outfits yet</h3>
          <p className="text-muted-foreground max-w-md">
            Generate outfits and save your favorites to access them here.
          </p>
          <Button variant="editorial" className="mt-6" asChild>
            <a href="/generator">Generate Outfits</a>
          </Button>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-8">
            <p className="text-muted-foreground">
              {savedOutfits.length} saved outfit{savedOutfits.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {savedOutfits.map((outfit) => (
              <Card key={outfit.id} className="card-editorial overflow-hidden group">
                {/* Outfit Preview Grid */}
                <div className="relative">
                  <div className="grid grid-cols-2 gap-0.5 bg-border">
                    {outfit.items.slice(0, 4).map((item, index) => (
                      <div
                        key={item.id}
                        className={`aspect-square bg-muted ${
                          outfit.items.length === 3 && index === 2 ? "col-span-2" : ""
                        }`}
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon-sm"
                      variant="secondary"
                      onClick={() => handleShare(outfit)}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="destructive"
                      onClick={() => handleRemove(outfit.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium">{outfit.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {outfit.items.length} items • Saved {outfit.savedAt.toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="font-display">
                      ${outfit.totalPrice.toFixed(2)}
                    </Badge>
                  </div>

                  {/* Item Pills */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {outfit.items.map((item) => (
                      <span
                        key={item.id}
                        className="text-xs bg-muted px-2 py-1 rounded-full"
                      >
                        {item.name}
                      </span>
                    ))}
                  </div>

                  <Button
                    variant="editorial-outline"
                    className="w-full"
                    onClick={() => handleAddToCart(outfit)}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Add All to Cart
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </DashboardLayout>
  );
};

export default Wishlist;
