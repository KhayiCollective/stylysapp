import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Package, Wand2, Settings2, ExternalLink, Sparkles, Menu, Heart, Settings, BookOpen, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}
const navigation = [{
  name: "Dashboard",
  href: "/dashboard",
  icon: LayoutDashboard
}, {
  name: "Catalog",
  href: "/catalog",
  icon: Package
}, {
  name: "Outfit Generator",
  href: "/generator",
  icon: Wand2
}, {
  name: "Saved Outfits",
  href: "/wishlist",
  icon: Heart
}, {
  name: "Rules",
  href: "/rules",
  icon: Settings2
}, {
  name: "Widget Demo",
  href: "/widget",
  icon: ExternalLink
}, {
  name: "Settings",
  href: "/settings",
  icon: Settings
}, {
  name: "Docs",
  href: "/docs",
  icon: BookOpen
}, {
  name: "Support",
  href: "/support",
  icon: HelpCircle
}];
export function DashboardLayout({
  children,
  title,
  description
}: DashboardLayoutProps) {
  const location = useLocation();
  return <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-sidebar">
        <div className="p-6 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-foreground rounded-sm flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-background" />
            </div>
            <span className="font-display text-lg font-semibold">STYLYS</span>
          </Link>
        </div>
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navigation.map(item => {
            const isActive = location.pathname === item.href;
            return <li key={item.name}>
                  <Link to={item.href} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}>
                    <item.icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                </li>;
          })}
          </ul>
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <div className="px-3 py-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Brand</p>
            <p className="text-sm font-medium">Demo Store</p>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between h-14 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-foreground rounded-sm flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-background" />
            </div>
            <span className="font-display text-lg font-semibold">STYLYS</span>
          </Link>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="p-6 border-b border-border">
                <Link to="/" className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-foreground rounded-sm flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-background" />
                  </div>
                  <span className="font-display text-lg font-semibold">STYLYS</span>
                </Link>
              </div>
              <nav className="p-4">
                <ul className="space-y-1">
                  {navigation.map(item => {
                  const isActive = location.pathname === item.href;
                  return <li key={item.name}>
                        <Link to={item.href} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors", isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50")}>
                          <item.icon className="w-4 h-4" />
                          {item.name}
                        </Link>
                      </li>;
                })}
                </ul>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:overflow-auto">
        <div className="pt-14 lg:pt-0">
          {/* Page Header */}
          <header className="border-b border-border bg-background/50 backdrop-blur-sm sticky top-14 lg:top-0 z-40">
            <div className="px-6 lg:px-8 py-6">
              <h1 className="font-display text-2xl lg:text-3xl font-medium">{title}</h1>
              {description && <p className="text-muted-foreground mt-1">{description}</p>}
            </div>
          </header>

          {/* Page Content */}
          <div className="p-6 lg:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>;
}