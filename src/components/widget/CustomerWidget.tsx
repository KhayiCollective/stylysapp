import { useState, useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, Camera, User, ShoppingBag, X, Sparkles } from "lucide-react";
import stylysIcon from "@/assets/S_no_border.png";
import { StyleQuizTab } from "./tabs/StyleQuizTab";
import { OutfitsTab } from "./tabs/OutfitsTab";
import { WishlistTab } from "./tabs/WishlistTab";
import { TryOnTab } from "./tabs/TryOnTab";
import { AccountTab } from "./tabs/AccountTab";

interface OutfitItem {
  id?: string;
  name: string;
  imageUrl: string;
  category: string;
  shopify_variant_id?: string;
  price?: number;
}

interface CustomerWidgetProps {
  brandId?: string;
  externalOpen?: boolean;
  externalTab?: string;
  onOpenChange?: (open: boolean) => void;
  onTabChange?: (tab: string) => void;
  anchorProductId?: string;
  anchorProductName?: string;
  onClearAnchor?: () => void;
}

export function CustomerWidget({ brandId, externalOpen, externalTab, onOpenChange, onTabChange, anchorProductId, anchorProductName, onClearAnchor }: CustomerWidgetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isLoggedIn = !!localStorage.getItem(`stylys_customer_token_${brandId || "default"}`);
  const [internalTab, setInternalTab] = useState(isLoggedIn ? "outfits" : "account");
  const [selectedOutfitItems, setSelectedOutfitItems] = useState<OutfitItem[] | undefined>();
  const [customerPhotoUrl, setCustomerPhotoUrl] = useState<string | null>(null);
  const [customerToken, setCustomerToken] = useState<string | null>(null);

  const open = externalOpen ?? internalOpen;
  const activeTab = externalTab ?? internalTab;

  const setOpen = (v: boolean) => {
    onOpenChange ? onOpenChange(v) : setInternalOpen(v);
  };
  const setActiveTab = (v: string) => {
    onTabChange ? onTabChange(v) : setInternalTab(v);
  };
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // When widget opens, default to outfits tab for logged-in users
  useEffect(() => {
    if (open && isLoggedIn && activeTab === "account") {
      setActiveTab("outfits");
    }
  }, [open]);

  const handleSelectOutfitForTryOn = (items: OutfitItem[]) => {
    setSelectedOutfitItems(items);
    setActiveTab("tryon");
  };

  const handleCustomerLogin = (photoUrl: string | null, token: string) => {
    setCustomerPhotoUrl(photoUrl);
    setCustomerToken(token);
  };

  return (
    <>
      {/* Desktop: Edge tab on right side */}
      {!isMobile && !open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-50 flex items-center gap-2 bg-primary text-primary-foreground px-2 py-4 rounded-l-lg shadow-lg hover:shadow-xl transition-all hover:pr-4 group writing-vertical"
          style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
        >
          <img src={stylysIcon} alt="STYLYS" className="h-5 w-5 rounded-full object-cover rotate-90 group-hover:animate-pulse" />
          <span className="text-xs font-semibold tracking-widest uppercase">Style Me</span>
        </button>
      )}

      {/* Mobile: Floating button */}
      {isMobile && !open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-105 active:scale-95"
        >
          <img src={stylysIcon} alt="STYLYS" className="h-8 w-8 rounded-full object-cover" />
        </button>
      )}

      {/* Sidebar panel */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[420px] p-0 flex flex-col gap-0 border-l border-border/50"
        >
          {/* Header */}
          <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full overflow-hidden">
                <img src={stylysIcon} alt="STYLYS" className="h-full w-full object-cover" />
              </div>
              <div>
                <h2 className="font-semibold text-sm tracking-wide">STYLYS</h2>
                <p className="text-xs text-primary-foreground/60">Your Personal Stylist</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="h-8 w-8 rounded-full hover:bg-primary-foreground/10 flex items-center justify-center transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tabbed content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="w-full rounded-none border-b border-border bg-card h-auto p-0 gap-0">
              <TabsTrigger value="account" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-1 text-xs gap-1">
                <User className="h-3.5 w-3.5" /> Account
              </TabsTrigger>
              <TabsTrigger value="quiz" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-1 text-xs gap-1">
                <Sparkles className="h-3.5 w-3.5" /> Quiz
              </TabsTrigger>
              <TabsTrigger value="outfits" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-1 text-xs gap-1">
                <ShoppingBag className="h-3.5 w-3.5" /> Outfits
              </TabsTrigger>
              <TabsTrigger value="wishlist" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-1 text-xs gap-1">
                <Heart className="h-3.5 w-3.5" /> Wishlist
              </TabsTrigger>
              <TabsTrigger value="tryon" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 px-1 text-xs gap-1">
                <Camera className="h-3.5 w-3.5" /> Try-On
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto">
              <TabsContent value="account" className="m-0 h-full">
                <AccountTab brandId={brandId} onNavigateToQuiz={() => setActiveTab("quiz")} onCustomerLogin={handleCustomerLogin} />
              </TabsContent>
              <TabsContent value="quiz" className="m-0 h-full">
                <StyleQuizTab brandId={brandId} onComplete={() => setActiveTab("outfits")} />
              </TabsContent>
              <TabsContent value="outfits" className="m-0 h-full">
                <OutfitsTab brandId={brandId} onSelectOutfitForTryOn={handleSelectOutfitForTryOn} anchorProductId={anchorProductId} anchorProductName={anchorProductName} onClearAnchor={onClearAnchor} />
              </TabsContent>
              <TabsContent value="wishlist" className="m-0 h-full">
                <WishlistTab brandId={brandId} />
              </TabsContent>
              <TabsContent value="tryon" className="m-0 h-full">
                <TryOnTab
                  outfitItems={selectedOutfitItems}
                  customerPhotoUrl={customerPhotoUrl || undefined}
                  brandId={brandId}
                  customerToken={customerToken || undefined}
                  onPhotoSaved={(url) => setCustomerPhotoUrl(url)}
                />
              </TabsContent>
            </div>
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  );
}
