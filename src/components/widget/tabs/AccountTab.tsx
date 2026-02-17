import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, Mail, LogIn, LogOut, Settings, Heart, ShoppingBag } from "lucide-react";

interface AccountTabProps {
  brandId?: string;
}

export function AccountTab({ brandId }: AccountTabProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = () => {
    // In production: create/login customer via widget edge function
    console.log(isSignUp ? "Sign up:" : "Login:", { email, name });
    setIsLoggedIn(true);
  };

  if (!isLoggedIn) {
    return (
      <div className="p-4 space-y-5">
        <div className="text-center pt-4">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <User className="h-7 w-7 text-primary" />
          </div>
          <h3 className="font-semibold text-base">{isSignUp ? "Create Account" : "Welcome Back"}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {isSignUp
              ? "Save your style profile, wishlist, and outfits."
              : "Sign in to access your saved preferences."}
          </p>
        </div>

        <div className="space-y-3">
          {isSignUp && (
            <div className="space-y-1.5">
              <Label htmlFor="account-name" className="text-xs">Name</Label>
              <Input
                id="account-name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="account-email" className="text-xs">Email</Label>
            <Input
              id="account-email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button className="w-full gap-2" size="sm" onClick={handleAuth} disabled={!email}>
            <LogIn className="h-4 w-4" />
            {isSignUp ? "Create Account" : "Sign In"}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-primary font-medium hover:underline"
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </div>
    );
  }

  // Logged in state
  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
        <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
          <User className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">{name || "Customer"}</p>
          <p className="text-xs text-muted-foreground">{email}</p>
        </div>
        <Badge variant="secondary" className="text-[10px]">Active</Badge>
      </div>

      <div className="space-y-2">
        <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors text-left">
          <Heart className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Saved Outfits</p>
            <p className="text-xs text-muted-foreground">2 outfits saved</p>
          </div>
        </button>
        <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors text-left">
          <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Order History</p>
            <p className="text-xs text-muted-foreground">View past purchases</p>
          </div>
        </button>
        <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors text-left">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Style Preferences</p>
            <p className="text-xs text-muted-foreground">Update your quiz answers</p>
          </div>
        </button>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="w-full text-muted-foreground gap-2"
        onClick={() => { setIsLoggedIn(false); setEmail(""); setName(""); }}
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </Button>
    </div>
  );
}
