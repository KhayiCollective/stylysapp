import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, Mail, LogIn, LogOut, Loader2, Check, ArrowLeft, Ruler, Palette, Sparkles, Camera } from "lucide-react";
import { getCustomerToken, setCustomerToken, clearCustomerToken } from "@/lib/widgetAuth";

interface AccountTabProps {
  brandId?: string;
  onNavigateToQuiz?: () => void;
  onCustomerLogin?: (photoUrl: string | null, token: string, styleProfile?: { body_shape?: string; size_info?: Record<string, string> }) => void;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const STYLE_OPTIONS = ["Minimalist", "Bohemian", "Classic", "Streetwear", "Romantic", "Edgy", "Preppy", "Athleisure"];
const COLOR_OPTIONS = ["Black", "White", "Navy", "Beige", "Red", "Green", "Pink", "Brown", "Blue", "Gray"];
const BODY_SHAPES = ["Hourglass", "Pear", "Apple", "Rectangle", "Triangle", "Inverted Triangle"];
const OCCASIONS = ["Work", "Casual", "Date Night", "Weekend", "Formal", "Travel", "Workout"];

const SIZE_OPTIONS = {
  tops: ["XS", "S", "M", "L", "XL", "XXL"],
  bottoms: ["24", "25", "26", "27", "28", "29", "30", "31", "32", "34", "36"],
  shoes: ["5", "5.5", "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "11", "12"],
};

type SubView = "home" | "style" | "sizing";

interface StyleProfile {
  style_preferences?: string[];
  preferred_colors?: string[];
  avoided_colors?: string[];
  body_shape?: string;
  size_info?: Record<string, string>;
  occasions?: string[];
  budget_range?: Record<string, number>;
  quiz_completed_at?: string;
}

interface CustomerUser {
  id: string;
  email: string;
  name: string | null;
  customer_id?: string | null;
  photo_url?: string | null;
  styleProfile?: StyleProfile | null;
}

export function AccountTab({ brandId, onNavigateToQuiz, onCustomerLogin }: AccountTabProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customerUser, setCustomerUser] = useState<CustomerUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [subView, setSubView] = useState<SubView>("home");
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Read shop from URL so backend can resolve brand by domain if brandId is stale
  const shopParam = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("shop") || undefined
    : undefined;


  // Style state
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [preferredColors, setPreferredColors] = useState<string[]>([]);
  const [avoidedColors, setAvoidedColors] = useState<string[]>([]);
  const [bodyShape, setBodyShape] = useState("");
  const [occasions, setOccasions] = useState<string[]>([]);
  const [sizeInfo, setSizeInfo] = useState<Record<string, string>>({ tops: "", bottoms: "", shoes: "" });

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
            populateStyleFromProfile(data.user.styleProfile);
            onCustomerLogin?.(data.user.photo_url || null, token!, { body_shape: data.user.styleProfile?.body_shape, size_info: data.user.styleProfile?.size_info });
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

  const populateStyleFromProfile = (profile?: StyleProfile | null) => {
    if (!profile) return;
    if (profile.style_preferences && Array.isArray(profile.style_preferences)) setSelectedStyles(profile.style_preferences);
    if (profile.preferred_colors && Array.isArray(profile.preferred_colors)) setPreferredColors(profile.preferred_colors);
    if (profile.avoided_colors && Array.isArray(profile.avoided_colors)) setAvoidedColors(profile.avoided_colors);
    if (profile.body_shape) setBodyShape(profile.body_shape);
    if (profile.occasions && Array.isArray(profile.occasions)) setOccasions(profile.occasions);
    if (profile.size_info && typeof profile.size_info === "object") setSizeInfo({ tops: "", bottoms: "", shoes: "", ...profile.size_info });
  };

  const handleAuth = async () => {
    if (!email || !password || (!brandId && !shopParam)) return;
    setLoading(true);
    setError("");

    const endpoint = isSignUp ? "signup" : "login";
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/widget-customer-auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, brand_id: brandId, shop: shopParam, name: name || undefined }),
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
      onCustomerLogin?.(data.user.photo_url || null, data.token, { body_shape: data.user.styleProfile?.body_shape, size_info: data.user.styleProfile?.size_info });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email || (!brandId && !shopParam)) return;
    setLoading(true);
    setError("");
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/widget-customer-auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, brand_id: brandId, shop: shopParam }),
      });
      setForgotSent(true);
    } catch {
      // Show success anyway to avoid email enumeration
      setForgotSent(true);
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
    setSubView("home");
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = localStorage.getItem(getStorageKey(brandId));
    if (!token) return;

    setUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/widget-customer-auth/photo`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ photoBase64: base64 }),
        });
        const data = await resp.json();
        if (resp.ok && data.photo_url) {
          setCustomerUser(prev => prev ? { ...prev, photo_url: data.photo_url } : prev);
          onCustomerLogin?.(data.photo_url, token, { body_shape: customerUser?.styleProfile?.body_shape, size_info: customerUser?.styleProfile?.size_info as Record<string, string> | undefined });
        }
        setUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadingPhoto(false);
    }
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const saveProfile = async (section: "style" | "sizing") => {
    const token = localStorage.getItem(getStorageKey(brandId));
    if (!token) return;
    setSaving(true);

    const body: Record<string, unknown> = {};
    if (section === "style") {
      body.style_preferences = selectedStyles;
      body.preferred_colors = preferredColors;
      body.avoided_colors = avoidedColors;
      body.body_shape = bodyShape;
      body.occasions = occasions;
    } else {
      body.size_info = sizeInfo;
    }

    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/widget-customer-auth/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (resp.ok) {
        setSubView("home");
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const toggleItem = (item: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  if (checkingSession) {
    return (
      <div className="p-4 flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // --- AUTH FORM ---
  if (!isLoggedIn) {
    // Forgot-password sub-view
    if (forgotMode) {
      return (
        <div className="p-4 space-y-5">
          <div className="text-center pt-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Mail className="h-7 w-7 text-primary" />
            </div>
            <h3 className="font-semibold text-base">Reset your password</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {forgotSent
                ? "If an account exists for that email, we just sent a reset link. Check your inbox."
                : "Enter the email you used to sign up and we'll send you a reset link."}
            </p>
          </div>

          {!forgotSent && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="forgot-email" className="text-xs">Email</Label>
                <Input id="forgot-email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button className="w-full gap-2" size="sm" onClick={handleForgotPassword} disabled={!email || loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Send reset link
              </Button>
            </div>
          )}

          <div className="text-center">
            <button
              onClick={() => { setForgotMode(false); setForgotSent(false); setError(""); }}
              className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" /> Back to sign in
            </button>
          </div>
        </div>
      );
    }

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
              <Label htmlFor="account-name" className="text-xs">Full Name</Label>
              <Input id="account-name" placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} />
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
          <Button className="w-full gap-2" size="sm" onClick={handleAuth} disabled={!email || !password || (isSignUp && !name) || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {isSignUp ? "Create Account" : "Sign In"}
          </Button>
          {!isSignUp && (
            <div className="text-center">
              <button
                onClick={() => { setForgotMode(true); setError(""); setForgotSent(false); }}
                className="text-xs text-muted-foreground hover:text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}
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

  // --- STYLE PREFERENCES SUB-VIEW ---
  if (subView === "style") {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setSubView("home")} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h3 className="font-semibold text-base">Style Preferences</h3>
        </div>

        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium mb-2">Your Style</p>
            <div className="flex flex-wrap gap-2">
              {STYLE_OPTIONS.map((style) => (
                <Badge key={style} variant={selectedStyles.includes(style) ? "default" : "outline"} className="cursor-pointer px-3 py-1.5 text-xs transition-colors" onClick={() => toggleItem(style, selectedStyles, setSelectedStyles)}>
                  {selectedStyles.includes(style) && <Check className="h-3 w-3 mr-1" />}{style}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Colors You Love</p>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((color) => (
                <Badge key={color} variant={preferredColors.includes(color) ? "default" : "outline"} className="cursor-pointer px-3 py-1.5 text-xs transition-colors" onClick={() => toggleItem(color, preferredColors, setPreferredColors)}>
                  {preferredColors.includes(color) && <Check className="h-3 w-3 mr-1" />}{color}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Colors to Avoid</p>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((color) => (
                <Badge key={color} variant={avoidedColors.includes(color) ? "destructive" : "outline"} className="cursor-pointer px-3 py-1.5 text-xs transition-colors" onClick={() => toggleItem(color, avoidedColors, setAvoidedColors)}>
                  {color}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Body Shape</p>
            <div className="grid grid-cols-2 gap-2">
              {BODY_SHAPES.map((shape) => (
                <button key={shape} onClick={() => setBodyShape(shape)} className={`p-2.5 rounded-lg border text-xs text-left transition-colors ${bodyShape === shape ? "border-primary bg-primary/5 font-medium" : "border-border hover:border-primary/40"}`}>
                  {bodyShape === shape && <Check className="h-3 w-3 inline mr-1" />}{shape}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Occasions</p>
            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map((occ) => (
                <Badge key={occ} variant={occasions.includes(occ) ? "default" : "outline"} className="cursor-pointer px-3 py-1.5 text-xs transition-colors" onClick={() => toggleItem(occ, occasions, setOccasions)}>
                  {occasions.includes(occ) && <Check className="h-3 w-3 mr-1" />}{occ}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <Button className="w-full gap-2" size="sm" onClick={() => saveProfile("style")} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save Preferences
        </Button>
      </div>
    );
  }

  // --- SIZING SUB-VIEW ---
  if (subView === "sizing") {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setSubView("home")} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h3 className="font-semibold text-base">My Sizing</h3>
        </div>

        <div className="space-y-5">
          {(["tops", "bottoms", "shoes"] as const).map((cat) => (
            <div key={cat}>
              <p className="text-sm font-medium mb-2 capitalize">{cat}</p>
              <div className="flex flex-wrap gap-2">
                {SIZE_OPTIONS[cat].map((size) => (
                  <Badge key={size} variant={sizeInfo[cat] === size ? "default" : "outline"} className="cursor-pointer px-3 py-1.5 text-xs transition-colors" onClick={() => setSizeInfo(prev => ({ ...prev, [cat]: prev[cat] === size ? "" : size }))}>
                    {sizeInfo[cat] === size && <Check className="h-3 w-3 mr-1" />}{size}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Button className="w-full gap-2" size="sm" onClick={() => saveProfile("sizing")} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save Sizing
        </Button>
      </div>
    );
  }

  // --- HOME (logged in) ---
  const hasStyleProfile = selectedStyles.length > 0 || bodyShape;
  const hasSizing = sizeInfo.tops || sizeInfo.bottoms || sizeInfo.shoes;

  return (
    <div className="p-4 space-y-5">
      {/* Avatar with photo upload */}
      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="relative h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center overflow-hidden group shrink-0"
          disabled={uploadingPhoto}
        >
          {customerUser?.photo_url ? (
            <img src={customerUser.photo_url} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            <User className="h-5 w-5" />
          )}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Camera className="h-4 w-4 text-white" />}
          </div>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
        <div className="flex-1">
          <p className="font-medium text-sm">{customerUser?.name || "Customer"}</p>
          <p className="text-xs text-muted-foreground">{customerUser?.email}</p>
        </div>
        <Badge variant="secondary" className="text-[10px]">Active</Badge>
      </div>

      <div className="space-y-2">
        <button
          onClick={() => setSubView("style")}
          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors text-left border border-border"
        >
          <Palette className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">Style Preferences</p>
            <p className="text-xs text-muted-foreground">
              {hasStyleProfile
                ? `${selectedStyles.slice(0, 2).join(", ")}${selectedStyles.length > 2 ? ` +${selectedStyles.length - 2}` : ""}`
                : "Set your style, colors & body shape"}
            </p>
          </div>
          {hasStyleProfile && <Check className="h-4 w-4 text-primary" />}
        </button>

        <button
          onClick={() => setSubView("sizing")}
          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors text-left border border-border"
        >
          <Ruler className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">My Sizing</p>
            <p className="text-xs text-muted-foreground">
              {hasSizing
                ? [sizeInfo.tops && `Tops: ${sizeInfo.tops}`, sizeInfo.bottoms && `Bottoms: ${sizeInfo.bottoms}`, sizeInfo.shoes && `Shoes: ${sizeInfo.shoes}`].filter(Boolean).join(" · ")
                : "Add your sizes for better recommendations"}
            </p>
          </div>
          {hasSizing && <Check className="h-4 w-4 text-primary" />}
        </button>

        {!hasStyleProfile && (
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Complete Your Profile</p>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Take the style quiz to get personalized outfit recommendations.
            </p>
            {onNavigateToQuiz && (
              <Button size="sm" variant="outline" className="gap-2" onClick={onNavigateToQuiz}>
                <Sparkles className="h-3.5 w-3.5" />
                Take Style Quiz
              </Button>
            )}
          </div>
        )}
      </div>

      <Button variant="ghost" size="sm" className="w-full text-muted-foreground gap-2" onClick={handleSignOut}>
        <LogOut className="h-4 w-4" />Sign Out
      </Button>
    </div>
  );
}
