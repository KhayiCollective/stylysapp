import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, ShoppingBag, Sparkles, RefreshCw, Loader2, LogIn, Camera } from "lucide-react";

interface OutfitItem {
  id: string;
  name: string;
  image_url?: string;
  imageUrl?: string;
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
  onSelectOutfitForTryOn?: (items: { name: string; imageUrl: string; category: string }[]) => void;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function getToken(brandId?: string) {
  return localStorage.getItem(`stylys_customer_token_${brandId || "default"}`);
}

export function OutfitsTab({ brandId, onSelectOutfitForTryOn }: OutfitsTabProps) {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  const isLoggedIn = !!getToken(brandId);

  const fetchOutfits = async () => {
    if (!brandId) return;
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/widget-outfits/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brandId }),
      });
      const data = await resp.json();
      if (!resp.ok) { setError(data.error || "Failed to load outfits"); return; }
      setOutfits((data.outfits || []).map((o: any) => ({
        id: o.id,
        name: o.name || "Look",
        items: (o.items || []).map((i: any) => ({
          id: i.id, name: i.name, price: Number(i.price),
          imageUrl: i.image_url || i.imageUrl,
          category: i.category,
        })),
        totalPrice: o.totalPrice,
        occasion: o.occasion,
      })));
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOutfits(); }, [brandId]);

  const toggleSave = async (outfit: Outfit) => {
    const token = getToken(brandId);
    if (!token) return;
    setSaving(outfit.id);
    try {
      if (savedIds.has(outfit.id)) {
        setSavedIds(prev => { const n = new Set(prev); n.delete(outfit.id); return n; });
      } else {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/widget-outfits/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ outfit_data: outfit, name: outfit.name }),
        });
        if (resp.ok) {
          setSavedIds(prev => new Set(prev).add(outfit.id));
        }
      }
    } catch { /* ignore */ }
    setSaving(null);
  };

  const handleTryOn = (outfit: Outfit) => {
    const items = outfit.items.map(i => ({
      name: i.name,
      imageUrl: i.imageUrl || i.image_url || "",
      category: i.category,
    }));
    onSelectOutfitForTryOn?.(items);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base">Your Outfits</h3>
          <p className="text-xs text-muted-foreground">AI-curated looks for you</p>
        </div>
        <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={fetchOutfits} disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground ml-2">Generating outfits...</span>
        </div>
      ) : outfits.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">No outfits yet</p>
          <p className="text-xs mt-1">No products available to create outfits from.</p>
        </div>
      ) : (
        outfits.map((outfit) => (
          <div key={outfit.id} className="border border-border rounded-lg overflow-hidden">
            <div className="p-3 flex items-center justify-between bg-muted/30">
              <div>
                <p className="font-medium text-sm">{outfit.name}</p>
                {outfit.occasion && <Badge variant="secondary" className="text-[10px] mt-1">{outfit.occasion}</Badge>}
              </div>
              {isLoggedIn ? (
                <button
                  onClick={() => toggleSave(outfit)}
                  disabled={saving === outfit.id}
                  className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                >
                  <Heart className={`h-4 w-4 ${savedIds.has(outfit.id) ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
                </button>
              ) : (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <LogIn className="h-3 w-3" /> Sign in to save
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-px bg-border">
              {outfit.items.map((item) => (
                <div key={item.id} className="bg-card">
                  <div className="aspect-square overflow-hidden">
                    <img src={item.imageUrl || item.image_url || ""} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-2">
                    <p className="text-[11px] truncate">{item.name}</p>
                    <p className="text-[11px] text-muted-foreground">${item.price}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 flex items-center justify-between border-t border-border gap-2">
              <span className="font-semibold text-sm">${outfit.totalPrice.toFixed(2)}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 gap-1"
                  onClick={() => handleTryOn(outfit)}
                >
                  <Camera className="h-3 w-3" />
                  Try On
                </Button>
                <Button size="sm" className="text-xs h-8 gap-1">
                  <ShoppingBag className="h-3 w-3" />
                  Add All
                </Button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
