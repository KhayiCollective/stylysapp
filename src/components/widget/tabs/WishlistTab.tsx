import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Heart, ShoppingBag, Trash2 } from "lucide-react";

interface WishlistItem {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
}

// Demo data — in production, persisted per customer
const DEMO_WISHLIST: WishlistItem[] = [
  { id: "w1", name: "Cashmere Sweater", imageUrl: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=300", price: 189 },
  { id: "w2", name: "Leather Ankle Boots", imageUrl: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=300", price: 249 },
];

export function WishlistTab() {
  const [items, setItems] = useState<WishlistItem[]>(DEMO_WISHLIST);

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-base">Wishlist</h3>
        <p className="text-xs text-muted-foreground">{items.length} saved item{items.length !== 1 ? "s" : ""}</p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Heart className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">Your wishlist is empty</p>
          <p className="text-xs mt-1">Save items you love from your outfit recommendations.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                <img src={item.imageUrl} alt={item.name} className="w-16 h-16 rounded-md object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-sm text-muted-foreground">${item.price}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(item.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button className="w-full gap-2" size="sm">
            <ShoppingBag className="h-4 w-4" />
            Add All to Cart — ${items.reduce((sum, i) => sum + i.price, 0)}
          </Button>
        </>
      )}
    </div>
  );
}
