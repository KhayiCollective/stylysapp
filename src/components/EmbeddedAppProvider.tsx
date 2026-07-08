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
  const [connectionChecked, setConnectionChecked] = useState(false);

  useEffect(() => {
    // Only load App Bridge script if we detect embedded context
    const params = new URLSearchParams(window.location.search);
    const widgetRoutes = ["/widget-preview", "/widget-reset-password"];
    const embedded = window.self !== window.top && params.has("shop") && !widgetRoutes.includes(window.location.pathname);

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

  // Look up brand_id by shop domain. Only counts as connected if shopify_connected_at is set.
  useEffect(() => {
    const shop = config?.shop;
    if (!isEmbedded || !shop) return;
    const shopDomainClean = shop.replace('.myshopify.com', '');
    supabase
      .from('brands')
      .select('id, shopify_connected_at')
      .or(`shopify_store_domain.eq.${shop},shopify_store_domain.ilike.%${shopDomainClean}%`)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id && data.shopify_connected_at) setEmbeddedBrandId(data.id);
      })
      .finally(() => setConnectionChecked(true));
  }, [isEmbedded, config?.shop]);

  // Fallback: if no connected brand found, attempt token exchange using App Bridge session token.
  useEffect(() => {
    if (!scriptLoaded || !connectionChecked || embeddedBrandId || !isEmbedded || !config?.shop) return;

    const attemptTokenExchange = async () => {
      const sessionToken = await getSessionToken();
      if (!sessionToken) return;

      try {
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-oauth?action=token-exchange`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_token: sessionToken, shop: config.shop }),
          }
        );
        const result = await resp.json();
        if (resp.ok && result.brand_id) {
          setEmbeddedBrandId(result.brand_id);
        } else {
          console.error("[EmbeddedAppProvider] Token exchange failed:", result.error);
        }
      } catch (err) {
        console.error("[EmbeddedAppProvider] Token exchange error:", err);
      }
    };

    attemptTokenExchange();
  }, [scriptLoaded, connectionChecked, embeddedBrandId, isEmbedded, config?.shop]);

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
