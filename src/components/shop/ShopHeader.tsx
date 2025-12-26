import { Link } from "react-router-dom";
import { CartDrawer } from "./CartDrawer";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";

export const ShopHeader = () => {
  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/shop" className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              KHAYI COLLECTIVE
            </h1>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link 
              to="/shop" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Shop
            </Link>
            <Link 
              to="/shop/account" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Account
            </Link>
          </nav>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="md:hidden">
              <Link to="/shop/account">
                <User className="h-5 w-5" />
              </Link>
            </Button>
            <CartDrawer />
          </div>
        </div>
      </div>
    </header>
  );
};
