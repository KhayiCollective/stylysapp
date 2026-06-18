import { createContext, useContext, ReactNode, useEffect, useState } from "react";
import { useShopifyAppBridge, AppBridgeConfig } from "@/hooks/useShopifyAppBridge";

interface EmbeddedAppContextValue {
  isEmbedded: boolean;
  config: AppBridgeConfig | null;
  showToast: (message: string, isError?: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  getSessionToken: () => Promise<string | null>;
}

const EmbeddedAppContext = createContext<EmbeddedAppContextValue | null>(null);

interface EmbeddedAppProviderProps {
  children: ReactNode;
}

export function EmbeddedAppProvider({ children }: EmbeddedAppProviderProps) {
  const { config, isEmbedded, showToast, setAppLoading, getSessionToken } = useShopifyAppBridge();
  const [scriptLoaded, setScriptLoaded] = useState(false);

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

  const contextValue: EmbeddedAppContextValue = {
    isEmbedded,
    config,
    showToast,
    setLoading: setAppLoading,
    getSessionToken,
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
