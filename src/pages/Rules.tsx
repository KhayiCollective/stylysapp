import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Palette, Scale, DollarSign, Package, Info, Loader2, Layers, Sparkles, ShoppingBag, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmbeddedApp } from "@/components/EmbeddedAppProvider";

const iconMap: Record<string, React.ElementType> = {
  "Color Harmony": Palette,
  "Fit Balance": Scale,
  "Category Balance": Package,
  "Price Range Match": DollarSign,
  "In-Stock Only": Package,
  "Seasonal Relevance": Palette,
  "Outfit Composition": Layers,
};

interface DbRule {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  category: string;
  config: any;
}

interface WidgetProduct {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  category: string;
}

interface WidgetOutfit {
  id: string;
  name?: string;
  items: WidgetProduct[];
  totalPrice: number;
}

interface CompositionConfig {
  minItems: number;
  maxItems: number;
  requiredCategories: string[];
  optionalCategories: string[];
}

const defaultComposition: CompositionConfig = {
  minItems: 3,
  maxItems: 5,
  requiredCategories: ["tops", "bottoms"],
  optionalCategories: ["shoes", "bags", "accessories", "hats", "sunglasses", "jewelry"],
};

const ALL_CATEGORIES = ["tops", "bottoms", "dresses", "outerwear", "shoes", "bags", "accessories", "hats", "sunglasses", "jewelry", "scarves"];

const Rules = () => {
  const [rules, setRules] = useState<DbRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [compositionConfig, setCompositionConfig] = useState<CompositionConfig>(defaultComposition);
  const [compositionRuleId, setCompositionRuleId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isEmbedded, embeddedBrandId } = useEmbeddedApp();

  // Widget demo state
  const [demoProducts, setDemoProducts] = useState<WidgetProduct[]>([]);
  const [demoAnchor, setDemoAnchor] = useState<WidgetProduct | null>(null);
  const [demoOutfits, setDemoOutfits] = useState<WidgetOutfit[]>([]);
  const [demoGenerating, setDemoGenerating] = useState(false);
  const [demoSelectedOutfit, setDemoSelectedOutfit] = useState<WidgetOutfit | null>(null);
  const [demoLoaded, setDemoLoaded] = useState(false);

  useEffect(() => {
    if (user) fetchRules();
  }, [user]);

  const fetchRules = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("rules")
      .select("id, name, description, enabled, category, config");

    if (error) {
      console.error("Failed to fetch rules:", error);
      toast({ title: "Failed to load rules", variant: "destructive" });
    } else if (data) {
      setRules(data);
      const comp = data.find(r => r.category === "composition");
      if (comp) {
        setCompositionRuleId(comp.id);
        const cfg = comp.config as any;
        setCompositionConfig({
          minItems: cfg?.minItems ?? defaultComposition.minItems,
          maxItems: cfg?.maxItems ?? defaultComposition.maxItems,
          requiredCategories: cfg?.requiredCategories ?? defaultComposition.requiredCategories,
          optionalCategories: cfg?.optionalCategories ?? defaultComposition.optionalCategories,
        });
      }
    }
    setLoading(false);
  };

  // Load demo products
  const loadDemoProducts = async () => {
    let resolvedBrandId: string | null = null;
    if (isEmbedded) {
      resolvedBrandId = embeddedBrandId;
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("brand_id")
        .eq("id", user?.id ?? "")
        .single();
      resolvedBrandId = profile?.brand_id ?? null;
    }
    if (!resolvedBrandId) return;
    // shadow with a const so the .eq() call below still compiles cleanly
    const brandId = resolvedBrandId;
    const { data } = await supabase
      .from("products")
      .select("id, name, image_url, price, category")
      .eq("brand_id", brandId)
      .eq("inventory_status", "in_stock")
      .limit(20);
    const mapped = (data || []).map(p => ({
      id: p.id, name: p.name,
      imageUrl: p.image_url || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=800&fit=crop",
      price: Number(p.price), category: p.category,
    }));
    setDemoProducts(mapped);
    if (mapped.length > 0) setDemoAnchor(mapped[0]);
    setDemoLoaded(true);
  };

  useEffect(() => {
    if (user && !demoLoaded) loadDemoProducts();
  }, [user]);

  const generateDemoOutfits = async () => {
    if (!demoAnchor || demoProducts.length < 2) return;
    setDemoGenerating(true);
    setDemoSelectedOutfit(null);
    try {
      const compRule = rules.find(r => r.category === "composition");
      const compositionRules = compRule?.enabled ? compRule.config : undefined;
      const { data, error } = await supabase.functions.invoke("generate-outfits", {
        body: {
          products: demoProducts.map(p => ({
            id: p.id, name: p.name, price: p.price,
            image_url: p.imageUrl, category: p.category, color: null, fit: null,
          })),
          anchorProductId: demoAnchor.id,
          rules: compositionRules,
        },
      });
      if (error) throw error;
      setDemoOutfits((data.outfits || []).map((o: any) => ({
        id: o.id, name: o.name,
        items: (o.products || o.items || []).map((p: any) => ({
          id: p.id, name: p.name, price: Number(p.price),
          imageUrl: p.image_url || p.imageUrl || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=500&fit=crop",
          category: p.category,
        })),
        totalPrice: o.totalPrice,
      })));
    } catch (err: any) {
      console.error("Demo outfit generation error:", err);
      toast({ title: "Failed to generate demo outfits", description: err.message, variant: "destructive" });
    } finally {
      setDemoGenerating(false);
    }
  };

  useEffect(() => {
    if (demoAnchor && demoProducts.length >= 2 && demoLoaded) generateDemoOutfits();
  }, [demoAnchor]);

  const handleToggle = async (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;
    const newEnabled = !rule.enabled;
    setRules(rules.map(r => r.id === ruleId ? { ...r, enabled: newEnabled } : r));
    
    const { error } = await supabase
      .from("rules")
      .update({ enabled: newEnabled })
      .eq("id", ruleId);

    if (error) {
      setRules(rules.map(r => r.id === ruleId ? { ...r, enabled: !newEnabled } : r));
      toast({ title: "Failed to update rule", variant: "destructive" });
    } else {
      toast({
        title: `${rule.name} ${newEnabled ? "enabled" : "disabled"}`,
        description: newEnabled ? "This rule will be applied to outfit generation." : "This rule will not affect outfit generation."
      });
    }
  };

  const saveCompositionConfig = async (newConfig: CompositionConfig) => {
    setCompositionConfig(newConfig);
    if (!compositionRuleId) return;

    const { error } = await supabase
      .from("rules")
      .update({ config: newConfig as any })
      .eq("id", compositionRuleId);

    if (error) {
      console.error("Failed to save composition config:", error);
    }
  };

  const stylingRules = rules.filter(r => r.category === "styling");
  const inventoryRules = rules.filter(r => r.category === "inventory");
  const pricingRules = rules.filter(r => r.category === "pricing");
  const compositionRule = rules.find(r => r.category === "composition");

  if (loading) {
    return (
      <DashboardLayout title="Styling Rules" description="Configure the rules that govern outfit generation">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading rules...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Styling Rules" description="Configure the rules that govern outfit generation">
      {/* Info Banner */}
      <Card className="mb-8 border-border/50 bg-muted/30">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">How rules work</p>
              <p className="text-sm text-muted-foreground mt-1">
                Enabled rules are applied when generating outfits. The AI combines multiple rules to create 
                balanced, on-brand outfit recommendations. Toggle rules on/off to customize the generation logic.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Outfit Composition */}
      {compositionRule && (
        <div className="mb-8">
          <h2 className="font-display text-xl mb-4 flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Outfit Composition
          </h2>
          <Card className={`card-editorial transition-all ${!compositionRule.enabled ? "opacity-60" : ""}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    compositionRule.enabled ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                  }`}>
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      {compositionRule.name}
                      <Badge variant={compositionRule.enabled ? "default" : "secondary"} className="text-[10px]">
                        {compositionRule.enabled ? "Active" : "Inactive"}
                      </Badge>
                    </CardTitle>
                  </div>
                </div>
                <Switch 
                  checked={compositionRule.enabled} 
                  onCheckedChange={() => handleToggle(compositionRule.id)}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <CardDescription className="text-sm leading-relaxed">
                {compositionRule.description}
              </CardDescription>

              {compositionRule.enabled && (
                <div className="space-y-6 pt-4 border-t border-border/50">
                  {/* Min/Max Items */}
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-sm">Min items per outfit: {compositionConfig.minItems}</Label>
                      <Slider
                        value={[compositionConfig.minItems]}
                        onValueChange={([v]) => saveCompositionConfig({ ...compositionConfig, minItems: v })}
                        min={2} max={6} step={1}
                      />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-sm">Max items per outfit: {compositionConfig.maxItems}</Label>
                      <Slider
                        value={[compositionConfig.maxItems]}
                        onValueChange={([v]) => saveCompositionConfig({ ...compositionConfig, maxItems: Math.max(v, compositionConfig.minItems) })}
                        min={2} max={8} step={1}
                      />
                    </div>
                  </div>

                  {/* Required Categories */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Required categories (always included)</Label>
                    <div className="flex flex-wrap gap-3">
                      {ALL_CATEGORIES.map(cat => (
                        <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={compositionConfig.requiredCategories.includes(cat)}
                            onCheckedChange={(checked) => {
                              const updated = checked
                                ? [...compositionConfig.requiredCategories, cat]
                                : compositionConfig.requiredCategories.filter(c => c !== cat);
                              // Remove from optional if adding to required
                              const updatedOptional = checked
                                ? compositionConfig.optionalCategories.filter(c => c !== cat)
                                : compositionConfig.optionalCategories;
                              saveCompositionConfig({ ...compositionConfig, requiredCategories: updated, optionalCategories: updatedOptional });
                            }}
                          />
                          <span className="capitalize">{cat}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Optional Categories */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Optional categories (included when available)</Label>
                    <div className="flex flex-wrap gap-3">
                      {ALL_CATEGORIES.filter(c => !compositionConfig.requiredCategories.includes(c)).map(cat => (
                        <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={compositionConfig.optionalCategories.includes(cat)}
                            onCheckedChange={(checked) => {
                              const updated = checked
                                ? [...compositionConfig.optionalCategories, cat]
                                : compositionConfig.optionalCategories.filter(c => c !== cat);
                              saveCompositionConfig({ ...compositionConfig, optionalCategories: updated });
                            }}
                          />
                          <span className="capitalize">{cat}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Styling Rules */}
      <div className="mb-8">
        <h2 className="font-display text-xl mb-4 flex items-center gap-2">
          <Palette className="w-5 h-5" />
          Styling Rules
        </h2>
        <div className="space-y-4">
          {stylingRules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} onToggle={handleToggle} />
          ))}
        </div>
      </div>

      {/* Inventory Rules */}
      <div className="mb-8">
        <h2 className="font-display text-xl mb-4 flex items-center gap-2">
          <Package className="w-5 h-5" />
          Inventory Rules
        </h2>
        <div className="space-y-4">
          {inventoryRules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} onToggle={handleToggle} />
          ))}
        </div>
      </div>

      {/* Pricing Rules */}
      <div className="mb-8">
        <h2 className="font-display text-xl mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Pricing Rules
        </h2>
        <div className="space-y-4">
          {pricingRules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} onToggle={handleToggle} />
          ))}
        </div>
      </div>

      {/* Widget Demo Preview */}
      <div className="mb-8">
        <h2 className="font-display text-xl mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          Widget Preview
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          See how your rules affect the "Complete the Look" widget. Adjust rules above and refresh the preview.
        </p>

        {demoProducts.length === 0 && demoLoaded ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>No products synced yet. Go to the Catalog page to sync your products first.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Compact Anchor Product */}
            {demoAnchor && (
              <div className="flex items-center gap-4 p-3 rounded-lg border border-border bg-card">
                <div className="w-20 h-28 rounded-md overflow-hidden bg-muted flex-shrink-0">
                  <img src={demoAnchor.imageUrl} alt={demoAnchor.name} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="uppercase tracking-widest text-[10px] text-muted-foreground mb-1">Anchor Product</p>
                  <Select
                    value={demoAnchor.id}
                    onValueChange={(val) => {
                      const found = demoProducts.find((p) => p.id === val);
                      if (found) setDemoAnchor(found);
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {demoProducts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex items-center gap-2">
                            <img src={p.imageUrl} alt={p.name} className="w-6 h-8 rounded object-cover flex-shrink-0" />
                            <span>{p.name} — ${p.price.toFixed(2)}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Complete the Look Card */}
            <Card className="card-editorial overflow-hidden">
              <div className="bg-foreground text-background p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4" />
                      <span className="uppercase tracking-widest text-[10px] font-semibold">AI Styled</span>
                    </div>
                    <h3 className="font-display text-lg font-medium">Complete the Look</h3>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-background/30 text-foreground hover:bg-background/10"
                    onClick={generateDemoOutfits}
                    disabled={demoGenerating}
                  >
                    <RefreshCw className={`w-4 h-4 mr-1 ${demoGenerating ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              <CardContent className="p-4">
                {demoGenerating ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
                    <span className="text-sm text-muted-foreground">Generating outfits...</span>
                  </div>
                ) : demoOutfits.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    No outfits generated yet. Click Refresh to generate.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {demoOutfits.map((outfit, index) => (
                      <div
                        key={outfit.id}
                        onClick={() => setDemoSelectedOutfit(demoSelectedOutfit?.id === outfit.id ? null : outfit)}
                        className={`p-3 rounded-md cursor-pointer transition-all border-l-2 ${
                          demoSelectedOutfit?.id === outfit.id
                            ? "border-l-foreground bg-muted/40"
                            : "border-l-transparent hover:bg-muted/20"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-display tracking-wide uppercase text-xs font-medium">
                            {outfit.name || `Look ${index + 1}`}
                          </span>
                          <span className="text-xs text-muted-foreground">${outfit.totalPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex items-end">
                          {outfit.items.map((item, i) => (
                            <div key={item.id} className={`${i > 0 ? "-ml-2" : ""} relative`} style={{ zIndex: outfit.items.length - i }}>
                              <div className="w-16 h-20 rounded-md overflow-hidden bg-muted border-2 border-card shadow-sm">
                                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                              </div>
                            </div>
                          ))}
                          <div className="ml-3 min-w-0 flex-1">
                            <p className="text-[10px] text-muted-foreground">{outfit.items.length} items</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {demoSelectedOutfit && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Outfit Total</p>
                        <p className="font-display text-lg font-medium">${demoSelectedOutfit.totalPrice.toFixed(2)}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">Save 15%</Badge>
                    </div>
                    <Button variant="editorial" size="sm" className="w-full" disabled>
                      <ShoppingBag className="w-3.5 h-3.5 mr-1.5" />Add Outfit to Cart
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground text-center">
              This preview reflects your current rules. Adjust rules above and click Refresh.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

const RuleCard = ({ 
  rule, 
  onToggle 
}: { 
  rule: DbRule; 
  onToggle: (id: string) => void;
}) => {
  const Icon = iconMap[rule.name] || Package;
  
  return (
    <Card className={`card-editorial transition-all ${!rule.enabled ? "opacity-60" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              rule.enabled ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
            }`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                {rule.name}
                <Badge variant={rule.enabled ? "default" : "secondary"} className="text-[10px]">
                  {rule.enabled ? "Active" : "Inactive"}
                </Badge>
              </CardTitle>
            </div>
          </div>
          <Switch 
            checked={rule.enabled} 
            onCheckedChange={() => onToggle(rule.id)}
          />
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm leading-relaxed">
          {rule.description}
        </CardDescription>
      </CardContent>
    </Card>
  );
};

export default Rules;
