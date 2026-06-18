import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Palette, Scale, DollarSign, Package, Layers, Settings2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
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

export function EmbeddedRules({ shop }: EmbeddedRulesProps) {
  const [searchParams] = useSearchParams();
  const [rules, setRules]   = useState<DbRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus]   = useState<"loading" | "empty" | "ok" | "error">("loading");

  useEffect(() => {
    if (!shop) { setLoading(false); setStatus("empty"); return; }

    let cancelled = false;
    const host = searchParams.get("host") ?? "";
    const hmac = searchParams.get("hmac") ?? "";

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("embedded-data", {
          body: { shop, host, hmac, resource: "rules" },
        });
        if (cancelled) return;
        if (error) {
          console.warn("[EmbeddedRules] edge fn error:", error.message);
          setStatus("error");
        } else if (!data?.brand) {
          setStatus("empty");
        } else {
          const rows = (data.rules ?? []) as DbRule[];
          setRules(rows);
          setStatus(rows.length === 0 ? "empty" : "ok");
        }
      } catch (err) {
        if (!cancelled) { console.warn("[EmbeddedRules] threw:", err); setStatus("error"); }
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
