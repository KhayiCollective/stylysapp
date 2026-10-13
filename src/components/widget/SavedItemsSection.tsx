import { useState } from "react";
import { Camera, Check, Heart, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { WishlistApi, WishlistItem } from "@/hooks/useWishlistItems";

const MAX_SELECTED = 6;

interface SavedItemsSectionProps {
  wishlist: WishlistApi;
  onTryOn: (items: WishlistItem[]) => void;
}

/** Pro feature: individual products the customer hearted. They tick the pieces they want and build their own look in Try-On. */
export function SavedItemsSection({ wishlist, onTryOn }: SavedItemsSectionProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState<string | null>(null);

  if (!wishlist.enabled) return null;
  const { items, loading } = wishlist;

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); return next; }
      if (next.size >= MAX_SELECTED) {
        toast(`Pick up to ${MAX_SELECTED} pieces per look`, { position: "top-center" });
        return prev;
      }
      next.add(id);
      return next;
    });
  };

  const remove = async (id: string) => {
    setRemoving(id);
    await wishlist.toggle({ item_id: id });
    setRemoving(null);
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const tryOnSelected = () => {
    const chosen = items.filter(i => selected.has(i.id));
    if (chosen.length) onTryOn(chosen);
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold text-base">Saved Items</h3>
        <p className="text-xs text-muted-foreground">
          Tap the pieces you like, then try them on together to build your own look.
        </p>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground border border-dashed border-border rounded-lg">
          <Heart className="h-6 w-6 mx-auto mb-2 opacity-50" />
          <p className="text-xs">No saved items yet. Tap the heart on any piece to save it here.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {items.map(item => {
              const isSel = selected.has(item.id);
              return (
                <div key={item.id} className="relative">
                  <button
                    type="button"
                    onClick={() => toggleSelect(item.id)}
                    className={`block w-full aspect-square rounded-md overflow-hidden border-2 ${isSel ? "border-primary" : "border-border"}`}
                    aria-pressed={isSel}
                  >
                    <img src={item.imageUrl} alt={item.name} className={`w-full h-full object-cover ${item.in_stock === false ? "opacity-60" : ""}`} />
                    {isSel && (
                      <span className="absolute top-1 left-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                    {item.in_stock === false && (
                      <span className="absolute bottom-1 left-1 bg-destructive text-destructive-foreground text-[9px] font-semibold px-1.5 py-0.5 rounded">Sold Out</span>
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${item.name} from saved items`}
                    onClick={() => remove(item.id)}
                    disabled={removing === item.id}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-background border border-border shadow flex items-center justify-center hover:bg-muted"
                  >
                    {removing === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                  </button>
                  <p className="text-[10px] truncate mt-1">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground">${Number(item.price || 0).toFixed(0)}</p>
                </div>
              );
            })}
          </div>
          <Button size="sm" className="w-full gap-2 text-xs" onClick={tryOnSelected} disabled={selected.size === 0}>
            <Camera className="h-3.5 w-3.5" />
            {selected.size === 0 ? "Select pieces to try on" : `Try On selected (${selected.size})`}
          </Button>
        </>
      )}
    </div>
  );
}
