import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, ShoppingCart, Layers, Eye, DollarSign, Users, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";

const Dashboard = () => {
  // Fetch real data from database
  const { data: outfitsData } = useQuery({
    queryKey: ["outfits-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outfits")
        .select("views, conversions, total_price, created_at");
      if (error) throw error;
      return data;
    }
  });

  const { data: productsCount } = useQuery({
    queryKey: ["products-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    }
  });

  const { data: customersCount } = useQuery({
    queryKey: ["customers-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    }
  });

  const { data: topOutfits } = useQuery({
    queryKey: ["top-outfits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outfits")
        .select("id, name, views, conversions")
        .order("conversions", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    }
  });

  // Calculate stats
  const totalOutfits = outfitsData?.length || 0;
  const totalViews = outfitsData?.reduce((sum, o) => sum + (o.views || 0), 0) || 0;
  const totalConversions = outfitsData?.reduce((sum, o) => sum + (o.conversions || 0), 0) || 0;
  const totalRevenue = outfitsData?.reduce((sum, o) => sum + (o.conversions || 0) * Number(o.total_price || 0), 0) || 0;
  const conversionRate = totalViews > 0 ? ((totalConversions / totalViews) * 100).toFixed(1) : "0";

  const stats = [
    {
      title: "Total Outfits",
      value: totalOutfits.toString(),
      change: "+12%",
      trend: "up",
      icon: Layers,
      description: "vs. last month"
    },
    {
      title: "Widget Views",
      value: totalViews.toLocaleString(),
      change: "+23%",
      trend: "up",
      icon: Eye,
      description: "vs. last month"
    },
    {
      title: "Conversions",
      value: totalConversions.toLocaleString(),
      change: "+18%",
      trend: "up",
      icon: ShoppingCart,
      description: "vs. last month"
    },
    {
      title: "Est. Revenue",
      value: `$${totalRevenue.toLocaleString()}`,
      change: "+8%",
      trend: "up",
      icon: DollarSign,
      description: "from outfit sales"
    },
  ];

  // Mock chart data - in production this would come from analytics
  const chartData = [
    { name: "Mon", views: 120, conversions: 24 },
    { name: "Tue", views: 180, conversions: 36 },
    { name: "Wed", views: 150, conversions: 30 },
    { name: "Thu", views: 220, conversions: 44 },
    { name: "Fri", views: 280, conversions: 56 },
    { name: "Sat", views: 340, conversions: 68 },
    { name: "Sun", views: 290, conversions: 58 },
  ];

  const categoryData = [
    { name: "Casual", value: 35, color: "hsl(var(--chart-1))" },
    { name: "Business", value: 25, color: "hsl(var(--chart-2))" },
    { name: "Evening", value: 20, color: "hsl(var(--chart-3))" },
    { name: "Weekend", value: 20, color: "hsl(var(--chart-4))" },
  ];

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
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                {stat.trend === "up" ? (
                  <ArrowUpRight className="w-3 h-3 text-success" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 text-destructive" />
                )}
                <span className={stat.trend === "up" ? "text-success" : "text-destructive"}>
                  {stat.change}
                </span>
                {" "}{stat.description}
              </p>
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
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card className="card-editorial">
          <CardHeader>
            <CardTitle className="font-display text-xl">Outfit Categories</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
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
    </DashboardLayout>
  );
};

export default Dashboard;
