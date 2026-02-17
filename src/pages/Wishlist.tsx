import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SavedOutfitRow {
  id: string;
  name: string | null;
  outfit_data: any;
  created_at: string;
  customer_account_id: string;
}

const Wishlist = () => {
  const [outfits, setOutfits] = useState<SavedOutfitRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSavedOutfits = async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("brand_id")
          .single();

        if (!profile?.brand_id) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("saved_outfits")
          .select("*")
          .eq("brand_id", profile.brand_id)
          .order("created_at", { ascending: false });

        if (!error && data) {
          setOutfits(data);
        }
      } catch (err) {
        console.error("Error fetching saved outfits:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSavedOutfits();
  }, []);

  return (
    <DashboardLayout
      title="Customer Outfits"
      description="Outfits saved by your customers from the widget"
    >
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : outfits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Heart className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="font-display text-xl font-medium mb-2">No customer outfits yet</h3>
          <p className="text-muted-foreground max-w-md">
            When customers save outfits from the widget on your store, they'll appear here.
          </p>
        </div>
      ) : (
        <>
          <p className="text-muted-foreground mb-8">
            {outfits.length} saved outfit{outfits.length !== 1 ? "s" : ""} from customers
          </p>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {outfits.map((outfit) => {
              const items = Array.isArray(outfit.outfit_data) ? outfit.outfit_data : [];
              return (
                <Card key={outfit.id} className="card-editorial overflow-hidden">
                  <div className="relative">
                    <div className="grid grid-cols-2 gap-0.5 bg-border">
                      {items.slice(0, 4).map((item: any, index: number) => (
                        <div
                          key={index}
                          className={`aspect-square bg-muted ${
                            items.length === 3 && index === 2 ? "col-span-2" : ""
                          }`}
                        >
                          {item.image_url || item.imageUrl ? (
                            <img
                              src={item.image_url || item.imageUrl}
                              alt={item.name || "Product"}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                              No image
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium">{outfit.name || "Untitled Outfit"}</h3>
                        <p className="text-xs text-muted-foreground">
                          {items.length} items • Saved {new Date(outfit.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {items.length > 0 && (
                        <Badge variant="outline" className="font-display">
                          {items.length} items
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {items.map((item: any, i: number) => (
                        <span
                          key={i}
                          className="text-xs bg-muted px-2 py-1 rounded-full"
                        >
                          {item.name || "Item"}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </DashboardLayout>
  );
};

export default Wishlist;
