import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, ShoppingCart, Layers, Eye, DollarSign, Users, ArrowUpRight, ArrowDownRight, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ShopifyConnection } from "@/components/ShopifyConnection";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useToast } from "@/hooks/use-toast";
import { useEmbeddedApp } from "@/components/EmbeddedAppProvider";
import { useEmbeddedInvoke } from "@/hooks/useEmbeddedInvoke";

interface DashboardStatsResponse {
  stats: {
    totalOutfits: number;
    totalViews: number;
    totalConversions: number;
    totalRevenue: number;
    productsCount: number;
    customersCount: number;
  };
  trends: {
    totalOutfits: number | null;
    totalViews: number | null;
    totalConversions: number | null;
    totalRevenue: number | null;
  };
  topOutfits: { id: string; name: string; views: number; conversions: number }[];
  categoryBreakdown: { name: string; count: number; value: number }[];
  weeklyPerformance: { name: string; views: number; conversions: number }[];
}

const CATEGORY_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const Dashboard = () => {
  const { showOnboarding, completeOnboarding, refetch, isLoading: onboardingLoading } = useOnboarding();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { isEmbedded, embeddedBrandId } = useEmbeddedApp();

  // Handle billing=success redirect from Shopify
  useEffect(() => {
    if (searchParams.get('billing') === 'success') {
      toast({
        title: "Subscription activated! 🎉",
        description: "Your 3-day free trial has started. Enjoy STYLYS!",
      });
      searchParams.delete('billing');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, toast]);

  const embeddedInvoke = useEmbeddedInvoke();

  // All brand-scoped stats come from one edge function call now (dashboard-stats)
  // instead of four separate direct table queries. Those queries had no
  // .eq("brand_id", ...) filter and relied on RLS to scope them — which works
  // for a logged-in Supabase Auth session, but the embedded Shopify Admin
  // dashboard never has one (see EmbeddedAppProvider.tsx), so for embedded
  // merchants those queries either came back empty (outfits/customers, no anon
  // policy) or, worse, unfiltered across every brand (products, which does have
  // an open anon SELECT policy for the customer widget's benefit).
  const { data: dashboardStats } = useQuery({
    queryKey: ["dashboard-stats", isEmbedded, embeddedBrandId],
    enabled: !isEmbedded || !!embeddedBrandId,
    queryFn: async () => {
      const { data, error } = await embeddedInvoke<DashboardStatsResponse>("dashboard-stats");
      if (error) throw error;
      return data;
    }
  });

  const { data: savedOutfits } = useQuery({
    queryKey: ["saved-outfits-dashboard", embeddedBrandId],
    enabled: !isEmbedded || !!embeddedBrandId,
    queryFn: async () => {
      let brandId: string | null = embeddedBrandId;
      if (!isEmbedded) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("brand_id")
          .single();
        brandId = profile?.brand_id ?? null;
      }
      if (!brandId) return [];
      const { data, error } = await supabase
        .from("saved_outfits")
        .select("*")
        .eq("brand_id", brandId)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data || [];
    }
  });

  // Calculate stats from the real, brand-scoped dashboard-stats response.
  const s = dashboardStats?.stats;
  const trends = dashboardStats?.trends;
  const totalOutfits = s?.totalOutfits || 0;
  const totalViews = s?.totalViews || 0;
  const totalConversions = s?.totalConversions || 0;
  const totalRevenue = s?.totalRevenue || 0;
  const productsCount = s?.productsCount || 0;
  const customersCount = s?.customersCount || 0;
  const conversionRate = totalViews > 0 ? ((totalConversions / totalViews) * 100).toFixed(1) : "0";
  const topOutfits = dashboardStats?.topOutfits || [];

  // Real week-over-week change, computed server-side from widget_events /
  // outfits.created_at. null means there's no reliable basis for a trend
  // (e.g. Est. Revenue, or a brand-new store with no prior-week data) — in
  // that case we simply omit the change badge instead of fabricating one.
  const formatChange = (pct: number | null | undefined) => {
    if (pct === null || pct === undefined) return null;
    return { text: `${pct > 0 ? "+" : ""}${pct}%`, trend: pct >= 0 ? "up" as const : "down" as const };
  };

  const stats = [
    {
      title: "Total Outfits",
      value: totalOutfits.toString(),
      rawValue: totalOutfits,
      change: formatChange(trends?.totalOutfits),
      icon: Layers,
      description: "vs. last week"
    },
    {
      title: "Widget Views",
      value: totalViews.toLocaleString(),
      rawValue: totalViews,
      change: formatChange(trends?.totalViews),
      icon: Eye,
      description: "vs. last week"
    },
    {
      title: "Conversions",
      value: totalConversions.toLocaleString(),
      rawValue: totalConversions,
      change: formatChange(trends?.totalConversions),
      icon: ShoppingCart,
      description: "vs. last week"
    },
    {
      title: "Est. Revenue",
      value: `$${totalRevenue.toLocaleString()}`,
      rawValue: totalRevenue,
      change: formatChange(trends?.totalRevenue),
      icon: DollarSign,
      description: "from outfit sales"
    },
  ];

  const chartData = dashboardStats?.weeklyPerformance || [];

  const categoryData = (dashboardStats?.categoryBreakdown || []).map((cat, index) => ({
    name: cat.name,
    value: cat.value,
    color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
  }));

  // Show onboarding wizard for new users
  if (!onboardingLoading && showOnboarding) {
    return <OnboardingWizard onComplete={completeOnboarding} onRefetch={refetch} />;
  }

  return (
    <DashboardLayout 
      title="Dashboard" 
      description="Track your outfit performance and customer engagement"
    >
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.title} className="card-editorial">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-semibold">{stat.value}</div>
              {stat.rawValue > 0 && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                {stat.change && (
                  <>
                    {stat.change.trend === "up" ? (
                      <ArrowUpRight className="w-3 h-3 text-success" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3 text-destructive" />
                    )}
                    <span className={stat.change.trend === "up" ? "text-success" : "text-destructive"}>
                      {stat.change.text}
                    </span>
                    {" "}
                  </>
                )}
                {stat.description}
              </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        {/* Performance Chart */}
        <Card className="card-editorial lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-xl">Weekly Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {totalOutfits === 0 ? (
              <div className="h-80 flex flex-col items-center justify-center text-muted-foreground">
                <TrendingUp className="w-8 h-8 mb-3 opacity-30" />
                <p className="text-sm font-medium">No data yet</p>
                <p className="text-xs mt-1">Performance data will appear once customers interact with the widget</p>
              </div>
            ) : (
              <>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorConversions" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))", 
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="views" 
                        stroke="hsl(var(--chart-1))" 
                        fillOpacity={1} 
                        fill="url(#colorViews)" 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="conversions" 
                        stroke="hsl(var(--chart-2))" 
                        fillOpacity={1} 
                        fill="url(#colorConversions)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(var(--chart-1))" }} />
                    <span className="text-sm text-muted-foreground">Views</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(var(--chart-2))" }} />
                    <span className="text-sm text-muted-foreground">Conversions</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card className="card-editorial">
          <CardHeader>
            <CardTitle className="font-display text-xl">Outfit Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {totalOutfits === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
                <Layers className="w-8 h-8 mb-3 opacity-30" />
                <p className="text-sm font-medium">No data yet</p>
                <p className="text-xs mt-1">Categories will appear once outfits are generated</p>
              </div>
            ) : (
              <>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {categoryData.map((cat) => (
                    <div key={cat.name} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-xs text-muted-foreground">{cat.name} ({cat.value}%)</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Shopify Connection Status */}
      <div className="mb-8">
        <ShopifyConnection />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Performing Outfits */}
        <Card className="card-editorial">
          <CardHeader>
            <CardTitle className="font-display text-xl">Top Performing Outfits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(topOutfits || []).length > 0 ? (
                topOutfits?.map((outfit, index) => (
                  <div 
                    key={outfit.id} 
                    className="flex items-center justify-between py-3 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-4">
                      <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium">{outfit.name || `Outfit ${index + 1}`}</p>
                        <p className="text-sm text-muted-foreground">{outfit.views || 0} views</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{outfit.conversions || 0}</p>
                      <p className="text-sm text-muted-foreground">conversions</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No outfits created yet</p>
                  <p className="text-sm">Generate your first outfit to see stats</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card className="card-editorial">
          <CardHeader>
            <CardTitle className="font-display text-xl">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Total Customers</p>
                    <p className="text-sm text-muted-foreground">Quiz completions</p>
                  </div>
                </div>
                <span className="text-2xl font-display font-semibold">{customersCount}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <ShoppingCart className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium">Products in Catalog</p>
                    <p className="text-sm text-muted-foreground">Active items</p>
                  </div>
                </div>
                <span className="text-2xl font-display font-semibold">{productsCount}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="font-medium">Conversion Rate</p>
                    <p className="text-sm text-muted-foreground">Views to cart</p>
                  </div>
                </div>
                <span className="text-2xl font-display font-semibold">{conversionRate}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Outfits */}
      <div className="mt-8">
        <Card className="card-editorial">
          <CardHeader>
            <CardTitle className="font-display text-xl flex items-center gap-2">
              <Heart className="w-5 h-5" />
              Customer Outfits
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!savedOutfits || savedOutfits.length === 0) ? (
              <div className="py-8 text-center text-muted-foreground">
                <Heart className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No customer outfits yet</p>
                <p className="text-sm">When customers save outfits from the widget, they'll appear here.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  {savedOutfits.length} recent saved outfit{savedOutfits.length !== 1 ? "s" : ""}
                </p>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {savedOutfits.map((outfit) => {
                    const items = Array.isArray(outfit.outfit_data) ? outfit.outfit_data : [];
                    return (
                      <div key={outfit.id} className="border border-border rounded-lg overflow-hidden">
                        <div className="grid grid-cols-2 gap-0.5 bg-border">
                          {items.slice(0, 4).map((item: any, index: number) => (
                            <div
                              key={index}
                              className={`aspect-square bg-muted ${items.length === 3 && index === 2 ? "col-span-2" : ""}`}
                            >
                              {(item.image_url || item.imageUrl) ? (
                                <img src={item.image_url || item.imageUrl} alt={item.name || "Product"} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No image</div>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="p-3">
                          <p className="font-medium text-sm">{outfit.name || "Untitled Outfit"}</p>
                          <p className="text-xs text-muted-foreground">
                            {items.length} items • {new Date(outfit.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
