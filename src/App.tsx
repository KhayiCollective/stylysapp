import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { EmbeddedAppProvider } from "@/components/EmbeddedAppProvider";
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Catalog from "./pages/Catalog";
import OutfitGenerator from "./pages/OutfitGenerator";
import Rules from "./pages/Rules";

import CustomerAccount from "./pages/CustomerAccount";
import Shop from "./pages/Shop";
import ProductDetail from "./pages/ProductDetail";
import ShopifyConnect from "./pages/ShopifyConnect";
import ShopifySetupGuide from "./pages/ShopifySetupGuide";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Support from "./pages/Support";
import AppStoreAssets from "./pages/AppStoreAssets";
import EmbeddedApp from "./pages/EmbeddedApp";
import ResetPassword from "./pages/ResetPassword";
import GettingStarted from "./pages/docs/GettingStarted";
import ShopifySetup from "./pages/docs/ShopifySetup";
import WidgetEmbed from "./pages/docs/WidgetEmbed";
import APIReference from "./pages/docs/APIReference";
import FAQ from "./pages/docs/FAQ";
import WidgetPreview from "./pages/WidgetPreview";
import WidgetResetPassword from "./pages/WidgetResetPassword";
import { useCartSync } from "@/hooks/useCartSync";

const queryClient = new QueryClient();

function CartSyncProvider({ children }: { children: React.ReactNode }) {
  useCartSync();
  return <>{children}</>;
}

// Redirect authenticated users away from auth page (unless selecting a plan)
function AuthRoute() {
  const { user, loading } = useAuth();
  const allowAuthed = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('view') === 'select-plan';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  
  if (user && !allowAuthed) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <Auth />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <EmbeddedAppProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <CartSyncProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<AuthRoute />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/catalog" element={<ProtectedRoute><Catalog /></ProtectedRoute>} />
              <Route path="/generator" element={<ProtectedRoute><OutfitGenerator /></ProtectedRoute>} />
              <Route path="/rules" element={<ProtectedRoute><Rules /></ProtectedRoute>} />
              <Route path="/wishlist" element={<Navigate to="/dashboard" replace />} />
              <Route path="/widget" element={<Navigate to="/rules" replace />} />
              <Route path="/widget-preview" element={<WidgetPreview />} />
              <Route path="/widget-reset-password" element={<WidgetResetPassword />} />
              <Route path="/settings" element={<ProtectedRoute requireShopify={false}><Settings /></ProtectedRoute>} />
              <Route path="/app-store-assets" element={<ProtectedRoute><AppStoreAssets /></ProtectedRoute>} />
              <Route path="/account/outfits" element={<CustomerAccount />} />
              {/* Shopify Embedded App (no Supabase auth required) */}
              <Route path="/embedded" element={<EmbeddedApp />} />
              <Route path="/embedded/*" element={<EmbeddedApp />} />
              {/* Shopify Connection */}
              <Route path="/connect-shopify" element={<ProtectedRoute><ShopifyConnect /></ProtectedRoute>} />
              <Route path="/shopify-setup" element={<ProtectedRoute><ShopifySetupGuide /></ProtectedRoute>} />
              {/* Shopify Store Routes */}
              <Route path="/shop" element={<Shop />} />
              <Route path="/shop/product/:handle" element={<ProductDetail />} />
              <Route path="/shop/account" element={<CustomerAccount />} />
              {/* Legal & Support */}
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/support" element={<Support />} />
              {/* Documentation */}
              <Route path="/docs" element={<GettingStarted />} />
              <Route path="/docs/getting-started" element={<GettingStarted />} />
              <Route path="/docs/shopify-setup" element={<ShopifySetup />} />
              <Route path="/docs/widget-embed" element={<WidgetEmbed />} />
              <Route path="/docs/api" element={<APIReference />} />
              <Route path="/docs/faq" element={<FAQ />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </CartSyncProvider>
          </BrowserRouter>
        </TooltipProvider>
      </EmbeddedAppProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
