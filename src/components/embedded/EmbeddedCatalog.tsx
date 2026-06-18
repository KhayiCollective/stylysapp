// build: embedded-catalog v3 (2026-06-18) — cache-bust
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImagePlus, Package } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Product {
  id: string;
  name: string;
  image_url: string | null;
  category: string;
  color: string | null;
  fit: string | null;
  price: number;
  inventory_status: string;
  tags?: string[];
}

interface EmbeddedCatalogProps {
  shop: string | null | undefined;
}

const STATUS_COLORS: Record<string, string> = {
  in_stock:     "bg-success/10 text-success border-success/20",
  low_stock:    "bg-warning/10 text-warning border-warning/20",
  out_of_stock: "bg-destructive/10 text-destructive border-destructive/20",
};

export function EmbeddedCatalog({ shop }: EmbeddedCatalogProps) {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [status, setStatus]     = useState<"loading" | "empty" | "ok" | "error">("loading");

  useEffect(() => {
    console.log("[EmbeddedCatalog] useEffect fired, shop:", shop);
    if (!shop) { setLoading(false); setStatus("empty"); return; }

    let cancelled = false;
    const host = searchParams.get("host") ?? "";
    const hmac = searchParams.get("hmac") ?? "";

    (async () => {
      try {
        console.log("[EmbeddedCatalog] invoking embedded-data", { shop, host, hmac, resource: "products" });
        const { data, error } = await supabase.functions.invoke("embedded-data", {
          body: { shop, host, hmac, resource: "products" },
        });
        console.log("[EmbeddedCatalog] invoke response — data:", data, "error:", error);
        console.log("[EmbeddedCatalog] invoke returned", { hasData: !!data, hasError: !!error, brand: data?.brand?.id ?? null, productCount: data?.products?.length ?? 0 });
        if (cancelled) return;
        if (error) {
          console.error("[EmbeddedCatalog] edge fn error:", error.message, error);
          setStatus("error");
        } else if (!data?.brand) {
          setStatus("empty");
        } else {
          const rows = (data.products ?? []) as Product[];
          setProducts(rows);
          setStatus(rows.length === 0 ? "empty" : "ok");
        }
      } catch (err) {
        if (!cancelled) { console.error("[EmbeddedCatalog] threw:", err); setStatus("error"); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [shop, searchParams]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <div className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        Loading catalog…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Could not load catalog data. Check your connection and try again.
      </div>
    );
  }

  if (status === "empty" || products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
        <Package className="h-10 w-10" />
        <p className="text-sm">No products in catalog yet.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">{products.length} products</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <Card key={product.id} className="overflow-hidden">
            <div className="aspect-[4/5] relative overflow-hidden bg-muted">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <ImagePlus className="h-10 w-10" />
                </div>
              )}
            </div>
            <CardContent className="p-3">
              <div className="mb-1 flex items-start justify-between gap-2">
                <h3 className="line-clamp-2 text-sm font-medium leading-tight">{product.name}</h3>
                <Badge
                  variant="outline"
                  className={`shrink-0 text-xs ${STATUS_COLORS[product.inventory_status] ?? ""}`}
                >
                  {product.inventory_status.replace("_", " ")}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5 text-xs text-muted-foreground">
                  <span className="capitalize">{product.category}</span>
                  {product.color && (
                    <><span>•</span><span className="capitalize">{product.color}</span></>
                  )}
                  {product.fit && (
                    <><span>•</span><span className="capitalize">{product.fit}</span></>
                  )}
                </div>
                <span className="text-sm font-medium">${product.price.toFixed(2)}</span>
              </div>
              {product.tags && product.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {product.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                  {product.tags.length > 3 && (
                    <Badge variant="secondary" className="text-xs">+{product.tags.length - 3}</Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
