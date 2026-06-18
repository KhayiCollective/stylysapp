import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Store, Package, ExternalLink, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface BrandData {
  id: string;
  name: string;
  slug: string | null;
  shopify_store_domain: string | null;
  shopify_connected_at: string | null;
}

interface ProductCount {
  count: number;
}

interface EmbeddedSettingsProps {
  shop: string | null | undefined;
}

function race<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export function EmbeddedSettings({ shop }: EmbeddedSettingsProps) {
  const [brand, setBrand]       = useState<BrandData | null>(null);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [loading, setLoading]   = useState(true);
  const [status, setStatus]     = useState<"loading" | "ok" | "empty" | "error">("loading");

  useEffect(() => {
    if (!shop) { setLoading(false); setStatus("empty"); return; }

    let cancelled = false;

    const run = async () => {
      try {
        const shopClean = shop.replace(".myshopify.com", "");

        const brandData = await race(
          supabase
            .from("brands")
            .select("id, name, slug, shopify_store_domain, shopify_connected_at")
            .or(`shopify_store_domain.eq.${shop},shopify_store_domain.ilike.%${shopClean}%`)
            .maybeSingle()
            .then(({ data, error }) => {
              if (error) { console.warn("[EmbeddedSettings] brand fetch error:", error.message); return null; }
              return data as BrandData | null;
            })
            .catch((err) => { console.warn("[EmbeddedSettings] brand fetch threw:", err); return null; }),
          3000,
          null
        );

        if (cancelled) return;

        if (!brandData) { setStatus("empty"); setLoading(false); return; }

        setBrand(brandData);
        setStatus("ok");

        // Best-effort product count — don't block on it
        race(
          supabase
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("brand_id", brandData.id)
            .then(({ count, error }) => {
              if (error) return null;
              return count;
            })
            .catch(() => null),
          3000,
          null
        ).then((count) => {
          if (!cancelled && count !== null) setProductCount(count);
        });
      } catch (err) {
        if (!cancelled) { console.warn("[EmbeddedSettings] unexpected error:", err); setStatus("error"); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [shop]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <div className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        Loading settings…
      </div>
    );
  }

  if (status === "error") {
    return <div className="py-8 text-center text-sm text-muted-foreground">Could not load settings. Check your connection and try again.</div>;
  }

  if (status === "empty" || !brand) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
        <Settings2 className="h-10 w-10" />
        <p className="text-sm">No brand data found for this shop.</p>
      </div>
    );
  }

  const connectedAt = brand.shopify_connected_at
    ? new Date(brand.shopify_connected_at).toLocaleDateString()
    : null;

  return (
    <div className="space-y-4 max-w-lg">
      {/* Brand Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Store className="h-4 w-4" />
            Brand
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{brand.name}</span>
          </div>
          {brand.shopify_store_domain && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Shopify store</span>
              <span className="font-medium">{brand.shopify_store_domain}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Shopify connected</span>
            {connectedAt ? (
              <Badge variant="secondary" className="text-xs font-normal">{connectedAt}</Badge>
            ) : (
              <span className="text-muted-foreground text-xs">Not connected</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Catalog Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Package className="h-4 w-4" />
            Catalog
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Products synced</span>
            <span className="font-medium">
              {productCount === null ? "—" : productCount.toLocaleString()}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Full settings link */}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        To manage your full account settings, open STYLYS outside of Shopify admin.
      </p>
    </div>
  );
}
