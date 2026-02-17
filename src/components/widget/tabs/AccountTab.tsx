import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, Mail, LogIn, LogOut, Settings, Heart, ShoppingBag, Loader2 } from "lucide-react";

interface AccountTabProps {
  brandId?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function getStorageKey(brandId?: string) {
  return `stylys_customer_token_${brandId || "default"}`;
}

export function AccountTab({ brandId }: AccountTabProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customerUser, setCustomerUser] = useState<{ id: string; email: string; name: string | null } | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem(getStorageKey(brandId));
    if (token) {
      fetch(`${SUPABASE_URL}/functions/v1/widget-customer-auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(data => {
          if (data.user) {
            setCustomerUser(data.user);
            setIsLoggedIn(true);
          } else {
            localStorage.removeItem(getStorageKey(brandId));
          }
        })
        .catch(() => localStorage.removeItem(getStorageKey(brandId)))
        .finally(() => setCheckingSession(false));
    } else {
      setCheckingSession(false);
    }
  }, [brandId]);

  const handleAuth = async () => {
    if (!email || !password || !brandId) return;
    setLoading(true);
    setError("");

    const endpoint = isSignUp ? "signup" : "login";
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/widget-customer-auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, brand_id: brandId, name: name || undefined }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      localStorage.setItem(getStorageKey(brandId), data.token);
      setCustomerUser(data.user);
      setIsLoggedIn(true);
      setPassword("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem(getStorageKey(brandId));
    setIsLoggedIn(false);
    setCustomerUser(null);
    setEmail("");
    setName("");
    setPassword("");
  };

  if (checkingSession) {
    return (
      <div className="p-4 flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="p-4 space-y-5">
        <div className="text-center pt-4">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <User className="h-7 w-7 text-primary" />
          </div>
          <h3 className="font-semibold text-base">{isSignUp ? "Create Account" : "Welcome Back"}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {isSignUp ? "Save your style profile, wishlist, and outfits." : "Sign in to access your saved preferences."}
          </p>
        </div>

        <div className="space-y-3">
          {isSignUp && (
            <div className="space-y-1.5">
              <Label htmlFor="account-name" className="text-xs">Name</Label>
              <Input id="account-name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="account-email" className="text-xs">Email</Label>
            <Input id="account-email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-password" className="text-xs">Password</Label>
            <Input id="account-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button className="w-full gap-2" size="sm" onClick={handleAuth} disabled={!email || !password || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {isSignUp ? "Create Account" : "Sign In"}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button onClick={() => { setIsSignUp(!isSignUp); setError(""); }} className="text-primary font-medium hover:underline">
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
        <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
          <User className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">{customerUser?.name || "Customer"}</p>
          <p className="text-xs text-muted-foreground">{customerUser?.email}</p>
        </div>
        <Badge variant="secondary" className="text-[10px]">Active</Badge>
      </div>

      <div className="space-y-2">
        <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors text-left">
          <Heart className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Saved Outfits</p>
            <p className="text-xs text-muted-foreground">View your saved looks</p>
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

      <Button variant="ghost" size="sm" className="w-full text-muted-foreground gap-2" onClick={handleSignOut}>
        <LogOut className="h-4 w-4" />Sign Out
      </Button>
    </div>
  );
}
