import { createContext, useContext, ReactNode, useEffect, useState } from "react";
import { useShopifyAppBridge, AppBridgeConfig } from "@/hooks/useShopifyAppBridge";
import { supabase } from "@/integrations/supabase/client";

interface EmbeddedAppContextValue {
  isEmbedded: boolean;
  config: AppBridgeConfig | null;
  showToast: (message: string, isError?: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  getSessionToken: () => Promise<string | null>;
  embeddedBrandId: string | null;
}

const EmbeddedAppContext = createContext<EmbeddedAppContextValue | null>(null);

interface EmbeddedAppProviderProps {
  children: ReactNode;
}

export function EmbeddedAppProvider({ children }: EmbeddedAppProviderProps) {
  const { config, isEmbedded, showToast, setAppLoading, getSessionToken } = useShopifyAppBridge();
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [embeddedBrandId, setEmbeddedBrandId] = useState<string | null>(null);

  useEffect(() => {
    // Only load App Bridge script if we detect embedded context
    const params = new URLSearchParams(window.location.search);
    const embedded = window.self !== window.top && params.has("shop");

    if (embedded && !scriptLoaded) {
      const script = document.createElement("script");
      script.src = "https://cdn.shopify.com/shopifycloud/app-bridge.js";
      script.async = true;
      script.onload = () => setScriptLoaded(true);
      document.head.appendChild(script);

      return () => {
        document.head.removeChild(script);
      };
    }
  }, [scriptLoaded]);

  // Look up brand_id by shop domain so embedded pages can skip the profiles query
  // (which requires auth.uid() and fails without a Supabase session).
  useEffect(() => {
    const shop = config?.shop;
    if (!isEmbedded || !shop) return;
    const shopDomainClean = shop.replace('.myshopify.com', '');
    supabase
      .from('brands')
      .select('id')
      .or(`shopify_store_domain.eq.${shop},shopify_store_domain.ilike.%${shopDomainClean}%`)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) setEmbeddedBrandId(data.id);
      });
  }, [isEmbedded, config?.shop]);

  const contextValue: EmbeddedAppContextValue = {
    isEmbedded,
    config,
    showToast,
    setLoading: setAppLoading,
    getSessionToken,
    embeddedBrandId,
  };

  return (
    <EmbeddedAppContext.Provider value={contextValue}>
      {children}
    </EmbeddedAppContext.Provider>
  );
}

export function useEmbeddedApp() {
  const context = useContext(EmbeddedAppContext);
  if (!context) {
    throw new Error("useEmbeddedApp must be used within EmbeddedAppProvider");
  }
  return context;
}
