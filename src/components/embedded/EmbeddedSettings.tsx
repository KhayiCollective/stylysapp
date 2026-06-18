import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Store, Package, ExternalLink, Settings2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface BrandData {
  id: string;
  name: string;
  slug: string | null;
  shopify_store_domain: string | null;
  shopify_connected_at: string | null;
}

interface EmbeddedSettingsProps {
  shop: string | null | undefined;
}

export function EmbeddedSettings({ shop }: EmbeddedSettingsProps) {
  const [searchParams] = useSearchParams();
  const [brand, setBrand]       = useState<BrandData | null>(null);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [loading, setLoading]   = useState(true);
  const [status, setStatus]     = useState<"loading" | "ok" | "empty" | "error">("loading");

  useEffect(() => {
    if (!shop) { setLoading(false); setStatus("empty"); return; }

    let cancelled = false;
    const host = searchParams.get("host") ?? "";
    const hmac = searchParams.get("hmac") ?? "";

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("embedded-data", {
          body: { shop, host, hmac, resource: "settings" },
        });
        if (cancelled) return;
        if (error) {
          console.warn("[EmbeddedSettings] edge fn error:", error.message);
          setStatus("error");
        } else if (!data?.brand) {
          setStatus("empty");
        } else {
          setBrand(data.brand as BrandData);
          setProductCount(typeof data.productCount === "number" ? data.productCount : 0);
          setStatus("ok");
        }
      } catch (err) {
        if (!cancelled) { console.warn("[EmbeddedSettings] threw:", err); setStatus("error"); }
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

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        To manage your full account settings, open STYLYS outside of Shopify admin.
      </p>
    </div>
  );
}
