import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Palette, Scale, DollarSign, Package, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Rule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  icon: React.ElementType;
  category: "styling" | "inventory" | "pricing";
}

const initialRules: Rule[] = [
  {
    id: "color_harmony",
    name: "Color Harmony",
    description: "Limit outfits to maximum 3 dominant colors for cohesive styling. Ensures pieces complement each other visually.",
    enabled: true,
    icon: Palette,
    category: "styling"
  },
  {
    id: "fit_balance",
    name: "Fit Balance",
    description: "Pair oversized items with fitted pieces to create visual balance. Prevents top-heavy or bottom-heavy silhouettes.",
    enabled: true,
    icon: Scale,
    category: "styling"
  },
  {
    id: "category_balance",
    name: "Category Balance",
    description: "Ensure each outfit includes a top, bottom, and optional layer. Creates complete, purchasable looks.",
    enabled: true,
    icon: Package,
    category: "styling"
  },
  {
    id: "price_balance",
    name: "Price Balance",
    description: "Mix high and low price points within outfits. Keeps total outfit cost accessible while featuring key pieces.",
    enabled: false,
    icon: DollarSign,
    category: "pricing"
  },
  {
    id: "in_stock_only",
    name: "In-Stock Only",
    description: "Only include products that are currently in stock. Prevents customer frustration from unavailable items.",
    enabled: true,
    icon: Package,
    category: "inventory"
  },
];

const Rules = () => {
  const [rules, setRules] = useState<Rule[]>(initialRules);
  const { toast } = useToast();

  const handleToggle = (ruleId: string) => {
    setRules(rules.map(rule => {
      if (rule.id === ruleId) {
        const newEnabled = !rule.enabled;
        toast({
          title: `${rule.name} ${newEnabled ? "enabled" : "disabled"}`,
          description: newEnabled 
            ? "This rule will be applied to outfit generation."
            : "This rule will not affect outfit generation."
        });
        return { ...rule, enabled: newEnabled };
      }
      return rule;
    }));
  };

  const stylingRules = rules.filter(r => r.category === "styling");
  const inventoryRules = rules.filter(r => r.category === "inventory");
  const pricingRules = rules.filter(r => r.category === "pricing");

  return (
    <DashboardLayout 
      title="Styling Rules" 
      description="Configure the rules that govern outfit generation"
    >
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
  rule: Rule; 
  onToggle: (id: string) => void;
}) => {
  const Icon = rule.icon;
  
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
