import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, ShoppingBag, Trash2, Loader2, LogIn } from "lucide-react";

interface SavedOutfit {
  id: string;
  name: string | null;
  outfit_data: any;
  created_at: string;
}

interface WishlistTabProps {
  brandId?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function getToken(brandId?: string) {
  return localStorage.getItem(`stylys_customer_token_${brandId || "default"}`);
}

export function WishlistTab({ brandId }: WishlistTabProps) {
  const [outfits, setOutfits] = useState<SavedOutfit[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const token = getToken(brandId);
  const isLoggedIn = !!token;

  const fetchSaved = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/widget-outfits/saved`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (resp.ok) setOutfits(data.outfits || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchSaved(); }, [brandId, isLoggedIn]);

  const handleDelete = async (outfitId: string) => {
    if (!token) return;
    setDeleting(outfitId);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/widget-outfits/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ outfit_id: outfitId }),
      });
      if (resp.ok) {
        setOutfits(prev => prev.filter(o => o.id !== outfitId));
      }
    } catch { /* ignore */ }
    setDeleting(null);
  };

  if (!isLoggedIn) {
    return (
      <div className="p-4 text-center py-12 text-muted-foreground">
        <Heart className="h-8 w-8 mx-auto mb-3 opacity-50" />
        <p className="text-sm font-medium">Sign in to see saved outfits</p>
        <p className="text-xs mt-1 flex items-center justify-center gap-1">
          <LogIn className="h-3 w-3" /> Go to Account tab to sign in
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-base">Saved Outfits</h3>
        <p className="text-xs text-muted-foreground">{outfits.length} saved look{outfits.length !== 1 ? "s" : ""}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : outfits.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Heart className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">No saved outfits yet</p>
          <p className="text-xs mt-1">Save outfits from the Outfits tab by tapping the heart icon.</p>
        </div>
      ) : (
        outfits.map((outfit) => {
          const items = Array.isArray(outfit.outfit_data?.items) ? outfit.outfit_data.items : [];
          const totalPrice = outfit.outfit_data?.totalPrice || items.reduce((s: number, i: any) => s + Number(i.price || 0), 0);

          return (
            <div key={outfit.id} className="border border-border rounded-lg overflow-hidden">
              <div className="p-3 flex items-center justify-between bg-muted/30">
                <div>
                  <p className="font-medium text-sm">{outfit.name || outfit.outfit_data?.name || "Saved Look"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Saved {new Date(outfit.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(outfit.id)}
                  disabled={deleting === outfit.id}
                  className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                >
                  {deleting === outfit.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              </div>

              {items.length > 0 && (
                <div className="grid grid-cols-3 gap-px bg-border">
                  {items.slice(0, 6).map((item: any, idx: number) => (
                    <div key={item.id || idx} className="bg-card">
                      <div className="aspect-square overflow-hidden">
                        <img
                          src={item.imageUrl || item.image_url || ""}
                          alt={item.name || "Product"}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-1.5">
                        <p className="text-[10px] truncate">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground">${Number(item.price || 0).toFixed(0)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-3 flex items-center justify-between border-t border-border">
                <span className="font-semibold text-sm">${Number(totalPrice).toFixed(2)}</span>
                <Button size="sm" className="text-xs h-8 gap-1">
                  <ShoppingBag className="h-3 w-3" />Add All to Cart
                </Button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
