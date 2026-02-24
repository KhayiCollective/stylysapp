import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, BookOpen, Rocket, Store, Code, HelpCircle, Sparkles, Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Getting Started", href: "/docs", icon: Rocket },
  { name: "Shopify Setup", href: "/docs/shopify-setup", icon: Store },
  { name: "Widget Embed", href: "/docs/widget-embed", icon: Code },
  { name: "API Reference", href: "/docs/api", icon: BookOpen },
  { name: "FAQ", href: "/docs/faq", icon: HelpCircle },
];

interface DocsLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export function DocsLayout({ children, title, description }: DocsLayoutProps) {
  const location = useLocation();
  const { user } = useAuth();
  const homeLink = user ? "/dashboard" : "/";

  const Sidebar = () => (
    <nav className="space-y-1">
      {navigation.map((item) => {
        const isActive = location.pathname === item.href;
        return (
          <Link
            key={item.name}
            to={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={homeLink}>
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                {user ? "Dashboard" : "Home"}
              </Button>
            </Link>
            <div className="hidden md:flex items-center gap-2">
              <div className="w-8 h-8 bg-foreground rounded-sm flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-background" />
              </div>
              <span className="font-display font-semibold">STYLYS Docs</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/support">
              <Button variant="outline" size="sm">Get Help</Button>
            </Link>
            
            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon-sm">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                <div className="py-4">
                  <h3 className="font-semibold mb-4">Documentation</h3>
                  <Sidebar />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Desktop Sidebar */}
          <aside className="hidden md:block w-64 shrink-0">
            <div className="sticky top-24">
              <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">
                Documentation
              </h3>
              <Sidebar />
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0 max-w-3xl">
            <div className="mb-8">
              <h1 className="font-display text-3xl md:text-4xl font-medium mb-2">{title}</h1>
              {description && (
                <p className="text-lg text-muted-foreground">{description}</p>
              )}
            </div>
            <div className="prose prose-neutral dark:prose-invert max-w-none">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-4">
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <span>•</span>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <span>•</span>
            <Link to="/support" className="hover:text-foreground transition-colors">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
