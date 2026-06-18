import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Palette, Scale, DollarSign, Package, Layers, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DbRule {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  category: string;
}

interface EmbeddedRulesProps {
  shop: string | null | undefined;
}

const ICON_MAP: Record<string, React.ElementType> = {
  "Color Harmony":     Palette,
  "Fit Balance":       Scale,
  "Category Balance":  Package,
  "Price Range Match": DollarSign,
  "In-Stock Only":     Package,
  "Seasonal Relevance": Palette,
  "Outfit Composition": Layers,
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  styling:     Palette,
  inventory:   Package,
  pricing:     DollarSign,
  composition: Layers,
};

const CATEGORY_LABELS: Record<string, string> = {
  styling:     "Styling Rules",
  inventory:   "Inventory Rules",
  pricing:     "Pricing Rules",
  composition: "Outfit Composition",
};

function race<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export function EmbeddedRules({ shop }: EmbeddedRulesProps) {
  const [rules, setRules]   = useState<DbRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus]   = useState<"loading" | "empty" | "ok" | "error">("loading");

  useEffect(() => {
    if (!shop) { setLoading(false); setStatus("empty"); return; }

    let cancelled = false;

    const run = async () => {
      try {
        const shopClean = shop.replace(".myshopify.com", "");

        // Look up brand_id from shop domain
        const brand = await race(
          supabase
            .from("brands")
            .select("id")
            .or(`shopify_store_domain.eq.${shop},shopify_store_domain.ilike.%${shopClean}%`)
            .maybeSingle()
            .then(({ data, error }) => {
              if (error) { console.warn("[EmbeddedRules] brand lookup error:", error.message); return null; }
              return data as { id: string } | null;
            })
            .catch((err) => { console.warn("[EmbeddedRules] brand lookup threw:", err); return null; }),
          3000,
          null
        );

        if (cancelled) return;
        if (!brand) { setStatus("empty"); setLoading(false); return; }

        const rows = await race(
          supabase
            .from("rules")
            .select("id, name, description, enabled, category")
            .eq("brand_id", brand.id)
            .order("category")
            .then(({ data, error }) => {
              if (error) { console.warn("[EmbeddedRules] rules fetch error:", error.message); return null; }
              return (data ?? []) as DbRule[];
            })
            .catch((err) => { console.warn("[EmbeddedRules] rules fetch threw:", err); return null; }),
          5000,
          null
        );

        if (cancelled) return;

        if (rows === null) { setStatus("error"); }
        else { setRules(rows); setStatus(rows.length === 0 ? "empty" : "ok"); }
      } catch (err) {
        if (!cancelled) { console.warn("[EmbeddedRules] unexpected error:", err); setStatus("error"); }
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
        Loading rules…
      </div>
    );
  }

  if (status === "error") {
    return <div className="py-8 text-center text-sm text-muted-foreground">Could not load rules. Check your connection and try again.</div>;
  }

  if (status === "empty" || rules.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
        <Settings2 className="h-10 w-10" />
        <p className="text-sm">No styling rules configured yet.</p>
      </div>
    );
  }

  // Group rules by category in display order
  const categoryOrder = ["composition", "styling", "inventory", "pricing"];
  const grouped = categoryOrder.reduce<Record<string, DbRule[]>>((acc, cat) => {
    const items = rules.filter((r) => r.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <p className="text-xs text-muted-foreground bg-muted/40 border rounded-md px-3 py-2">
        Rules are shown read-only in the embedded view. To toggle rules, open STYLYS from the standalone app.
      </p>

      {Object.entries(grouped).map(([category, items]) => {
        const CatIcon = CATEGORY_ICONS[category] ?? Package;
        return (
          <div key={category}>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <CatIcon className="h-4 w-4" />
              {CATEGORY_LABELS[category] ?? category}
            </h2>
            <div className="space-y-3">
              {items.map((rule) => {
                const Icon = ICON_MAP[rule.name] ?? Package;
                return (
                  <Card key={rule.id} className={rule.enabled ? "" : "opacity-60"}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                            rule.enabled ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                          }`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <CardTitle className="text-sm font-medium">{rule.name}</CardTitle>
                        </div>
                        <Badge variant={rule.enabled ? "default" : "secondary"} className="text-[10px]">
                          {rule.enabled ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </CardHeader>
                    {rule.description && (
                      <CardContent className="pt-0">
                        <CardDescription className="text-xs leading-relaxed">{rule.description}</CardDescription>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
