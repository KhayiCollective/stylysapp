import { ReactNode, useState, createContext, useContext } from "react";
import { StylingChatbot } from "./StylingChatbot";
import { SavedOutfitsWidget } from "./SavedOutfitsWidget";
import { CustomerWidget } from "../widget/CustomerWidget";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { hasFeature } from "@/lib/tiers";

// Context to allow ShopHeader and ProductCard to control the widget
interface WidgetControl {
  openAccountTab: () => void;
  buildOutfitAround: (productId: string, productName: string) => void;
}

const WidgetControlContext = createContext<WidgetControl>({ openAccountTab: () => {}, buildOutfitAround: () => {} });
export const useWidgetControl = () => useContext(WidgetControlContext);

interface OutfitItem {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
}

interface SavedOutfit {
  id: string;
  name: string;
  items: OutfitItem[];
  totalPrice: number;
  savedAt: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  color?: string;
  fit?: string;
  handle?: string;
  image?: string;
  variantId?: string;
}

interface ShopLayoutProps {
  children: ReactNode;
  products?: Product[];
}

// Mock saved outfits - in production these would come from the database
const initialSavedOutfits: SavedOutfit[] = [
  {
    id: "1",
    name: "Weekend Brunch Look",
    items: [
      { id: "p1", name: "Linen Blouse", imageUrl: "https://images.unsplash.com/photo-1598554747436-c9293d6a588f?w=400", price: 89 },
      { id: "p2", name: "Wide Leg Pants", imageUrl: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400", price: 129 },
    ],
    totalPrice: 218,
    savedAt: "2024-01-15",
  },
];

export function ShopLayout({ children, products = [] }: ShopLayoutProps) {
  const { tierName, loading: subscriptionLoading } = useSubscription();
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>(initialSavedOutfits);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [widgetTab, setWidgetTab] = useState("outfits");
  const BRAND_ID = "90729a9c-a8b2-4eda-9d82-ddbb970d5565";
  const isLoggedIn = !!(typeof window !== "undefined" && localStorage.getItem("stylys_customer_token"));
  const [anchorProductId, setAnchorProductId] = useState<string | undefined>();
  const [anchorProductName, setAnchorProductName] = useState<string | undefined>();
  const { toast } = useToast();

  const handleRemoveOutfit = (outfitId: string) => {
    setSavedOutfits((prev) => prev.filter((o) => o.id !== outfitId));
  };

  const handleAddToCart = (outfit: SavedOutfit) => {
    // In production, this would integrate with the cart system
    console.log("Adding to cart:", outfit);
  };

  const openAccountTab = () => {
    setWidgetTab("account");
    setWidgetOpen(true);
  };

  const buildOutfitAround = (productId: string, productName: string) => {
    setAnchorProductId(productId);
    setAnchorProductName(productName);
    setWidgetTab("outfits");
    setWidgetOpen(true);
  };

  const handleClearAnchor = () => {
    setAnchorProductId(undefined);
    setAnchorProductName(undefined);
  };

  const handleWidgetOpenChange = (open: boolean) => {
    setWidgetOpen(open);
    if (!open) {
      handleClearAnchor();
    }
  };

  return (
    <WidgetControlContext.Provider value={{ openAccountTab, buildOutfitAround }}>
      <div className="relative min-h-screen">
        {children}
        
        {/* Saved Outfits Widget - Bottom Left */}
        <SavedOutfitsWidget
          savedOutfits={savedOutfits}
          onRemove={handleRemoveOutfit}
          onAddToCart={handleAddToCart}
        />
        
        {/* AI Styling Chatbot - Bottom Right */}
        <StylingChatbot
          products={products}
          isProfessional={hasFeature(tierName, 'styling_chatbot')}
          subscriptionLoading={subscriptionLoading}
        />

        <CustomerWidget
          brandId={BRAND_ID}
          externalOpen={widgetOpen}
          externalTab={widgetTab}
          onOpenChange={handleWidgetOpenChange}
          onTabChange={setWidgetTab}
          anchorProductId={anchorProductId}
          anchorProductName={anchorProductName}
          onClearAnchor={handleClearAnchor}
        />
      </div>
    </WidgetControlContext.Provider>
  );
}
