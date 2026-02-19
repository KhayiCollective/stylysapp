import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, Camera, User, ShoppingBag, X, Sparkles } from "lucide-react";
import stylysIcon from "@/assets/stylys-icon.png";
import { StyleQuizTab } from "./tabs/StyleQuizTab";
import { OutfitsTab } from "./tabs/OutfitsTab";
import { WishlistTab } from "./tabs/WishlistTab";
import { TryOnTab } from "./tabs/TryOnTab";
import { AccountTab } from "./tabs/AccountTab";

interface OutfitItem {
  name: string;
  imageUrl: string;
  category: string;
}

interface InlineCustomerWidgetProps {
  brandId?: string;
}

export function InlineCustomerWidget({ brandId }: InlineCustomerWidgetProps) {
  const [activeTab, setActiveTab] = useState("account");
  const [selectedOutfitItems, setSelectedOutfitItems] = useState<OutfitItem[] | undefined>();
  const [customerPhotoUrl, setCustomerPhotoUrl] = useState<string | null>(null);
  const [customerToken, setCustomerToken] = useState<string | null>(null);
  const [bodyShape, setBodyShape] = useState<string | undefined>();
  const [sizeInfo, setSizeInfo] = useState<Record<string, string> | undefined>();

  const handleClose = () => {
    try {
      window.parent.postMessage({ type: "stylys-close" }, "*");
    } catch (e) {
      // silently fail if no parent
    }
  };

  const handleSelectOutfitForTryOn = (items: OutfitItem[]) => {
    setSelectedOutfitItems(items);
    setActiveTab("tryon");
  };

  const handleCustomerLogin = (photoUrl: string | null, token: string, styleProfile?: { body_shape?: string; size_info?: Record<string, string> }) => {
    setCustomerPhotoUrl(photoUrl);
    setCustomerToken(token);
    setBodyShape(styleProfile?.body_shape || undefined);
    setSizeInfo(styleProfile?.size_info || undefined);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between shrink-0">
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
          onClick={handleClose}
          className="h-8 w-8 rounded-full hover:bg-primary-foreground/10 flex items-center justify-center transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="w-full rounded-none border-b border-border bg-card h-auto p-0 gap-0 shrink-0">
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
            <OutfitsTab brandId={brandId} onSelectOutfitForTryOn={handleSelectOutfitForTryOn} />
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
              bodyShape={bodyShape}
              sizeInfo={sizeInfo}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
