import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, ShoppingBag, Sparkles, RefreshCw } from "lucide-react";

interface OutfitItem {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  category: string;
}

interface Outfit {
  id: string;
  name: string;
  items: OutfitItem[];
  totalPrice: number;
  occasion?: string;
}

interface OutfitsTabProps {
  brandId?: string;
}

// Demo outfits — in production these come from the widget edge function
const DEMO_OUTFITS: Outfit[] = [
  {
    id: "1",
    name: "Weekend Brunch",
    occasion: "Casual",
    items: [
      { id: "p1", name: "Linen Blouse", imageUrl: "https://images.unsplash.com/photo-1598554747436-c9293d6a588f?w=300", price: 89, category: "Top" },
      { id: "p2", name: "Wide Leg Pants", imageUrl: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=300", price: 129, category: "Bottom" },
      { id: "p3", name: "Canvas Tote", imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=300", price: 65, category: "Accessory" },
    ],
    totalPrice: 283,
  },
  {
    id: "2",
    name: "Office Chic",
    occasion: "Work",
    items: [
      { id: "p4", name: "Tailored Blazer", imageUrl: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=300", price: 229, category: "Layer" },
      { id: "p5", name: "Silk Cami", imageUrl: "https://images.unsplash.com/photo-1598554747436-c9293d6a588f?w=300", price: 79, category: "Top" },
      { id: "p6", name: "Slim Trousers", imageUrl: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=300", price: 149, category: "Bottom" },
    ],
    totalPrice: 457,
  },
];

export function OutfitsTab({ brandId }: OutfitsTabProps) {
  const [outfits] = useState<Outfit[]>(DEMO_OUTFITS);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const toggleSave = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base">Your Outfits</h3>
          <p className="text-xs text-muted-foreground">AI-curated looks for you</p>
        </div>
        <Button variant="ghost" size="sm" className="text-xs gap-1">
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
      </div>

      {outfits.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">No outfits yet</p>
          <p className="text-xs mt-1">Complete the Style Quiz to get personalized recommendations.</p>
        </div>
      ) : (
        outfits.map((outfit) => (
          <div key={outfit.id} className="border border-border rounded-lg overflow-hidden">
            {/* Outfit header */}
            <div className="p-3 flex items-center justify-between bg-muted/30">
              <div>
                <p className="font-medium text-sm">{outfit.name}</p>
                {outfit.occasion && (
                  <Badge variant="secondary" className="text-[10px] mt-1">{outfit.occasion}</Badge>
                )}
              </div>
              <button
                onClick={() => toggleSave(outfit.id)}
                className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
              >
                <Heart className={`h-4 w-4 ${savedIds.has(outfit.id) ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
              </button>
            </div>

            {/* Items grid */}
            <div className="grid grid-cols-3 gap-px bg-border">
              {outfit.items.map((item) => (
                <div key={item.id} className="bg-card">
                  <div className="aspect-square overflow-hidden">
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-2">
                    <p className="text-[11px] truncate">{item.name}</p>
                    <p className="text-[11px] text-muted-foreground">${item.price}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-3 flex items-center justify-between border-t border-border">
              <span className="font-semibold text-sm">${outfit.totalPrice}</span>
              <Button size="sm" className="text-xs h-8 gap-1">
                <ShoppingBag className="h-3 w-3" />
                Add All to Cart
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
