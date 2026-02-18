import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Palette, Scale, DollarSign, Package, Info, Loader2, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
