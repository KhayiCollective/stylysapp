import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Heart, ShoppingBag, Trash2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

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

interface SavedOutfitsWidgetProps {
  savedOutfits: SavedOutfit[];
  onRemove?: (outfitId: string) => void;
  onAddToCart?: (outfit: SavedOutfit) => void;
}

export function SavedOutfitsWidget({ savedOutfits, onRemove, onAddToCart }: SavedOutfitsWidgetProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const handleAddToCart = (outfit: SavedOutfit) => {
    onAddToCart?.(outfit);
    toast({
      title: "Added to cart",
      description: `${outfit.items.length} items from "${outfit.name}" added to your cart.`,
    });
  };

  const handleRemove = (outfitId: string) => {
    onRemove?.(outfitId);
    toast({
      title: "Outfit removed",
      description: "The outfit has been removed from your saved items.",
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className="fixed bottom-6 left-6 z-50 gap-2 shadow-lg hover:shadow-xl transition-all"
        >
          <Heart className="h-5 w-5" />
          <span className="hidden sm:inline">Saved Outfits</span>
          {savedOutfits.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {savedOutfits.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Heart className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <SheetTitle className="text-left">Saved Outfits</SheetTitle>
                <p className="text-xs text-muted-foreground">
                  {savedOutfits.length} outfit{savedOutfits.length !== 1 ? "s" : ""} saved
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/account/outfits" onClick={() => setOpen(false)}>
                <ExternalLink className="h-4 w-4 mr-1" />
                View All
              </Link>
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          {savedOutfits.length === 0 ? (
            <div className="p-8 text-center">
              <Heart className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No saved outfits yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Save outfits while browsing to see them here
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {savedOutfits.map((outfit) => (
                <div
                  key={outfit.id}
                  className="border border-border rounded-lg p-4 bg-card hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-sm">{outfit.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {outfit.items.length} items • ${outfit.totalPrice.toFixed(2)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemove(outfit.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex gap-2 mb-3">
                    {outfit.items.slice(0, 4).map((item) => (
                      <div
                        key={item.id}
                        className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0"
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                    {outfit.items.length > 4 && (
                      <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                        <span className="text-xs text-muted-foreground">
                          +{outfit.items.length - 4}
                        </span>
                      </div>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleAddToCart(outfit)}
                  >
                    <ShoppingBag className="h-4 w-4 mr-2" />
                    Add All to Cart
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
