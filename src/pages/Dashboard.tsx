import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, ShoppingCart, Layers, Eye } from "lucide-react";

// Mock data for demonstration
const stats = [
  {
    title: "Total Outfits Created",
    value: "247",
    change: "+12%",
    icon: Layers,
    description: "vs. last month"
  },
  {
    title: "Carts Influenced",
    value: "1,429",
    change: "+23%",
    icon: ShoppingCart,
    description: "vs. last month"
  },
  {
    title: "Widget Views",
    value: "8,512",
    change: "+18%",
    icon: Eye,
    description: "vs. last month"
  },
  {
    title: "Avg. Order Value Lift",
    value: "$34.20",
    change: "+8%",
    icon: TrendingUp,
    description: "vs. baseline"
  },
];

const topOutfits = [
  { id: 1, name: "Summer Casual #12", views: 423, conversions: 89 },
  { id: 2, name: "Business Chic #7", views: 387, conversions: 76 },
  { id: 3, name: "Weekend Vibes #3", views: 341, conversions: 68 },
  { id: 4, name: "Evening Out #15", views: 298, conversions: 54 },
  { id: 5, name: "Athleisure #9", views: 276, conversions: 51 },
];

const Dashboard = () => {
  return (
    <DashboardLayout 
      title="Dashboard" 
      description="Overview of your outfit performance and catalog"
    >
      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat, index) => (
          <Card key={stat.title} className="card-editorial border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-semibold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-success font-medium">{stat.change}</span> {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top Performing Outfits */}
      <Card className="card-editorial border-border/50">
        <CardHeader>
          <CardTitle className="font-display text-xl">Top Performing Outfits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topOutfits.map((outfit, index) => (
              <div 
                key={outfit.id} 
                className="flex items-center justify-between py-3 border-b border-border/50 last:border-0"
              >
                <div className="flex items-center gap-4">
                  <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium">{outfit.name}</p>
                    <p className="text-sm text-muted-foreground">{outfit.views} views</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{outfit.conversions}</p>
                  <p className="text-sm text-muted-foreground">conversions</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default Dashboard;
