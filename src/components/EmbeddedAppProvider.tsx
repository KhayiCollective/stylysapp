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
  const appBridge = useShopifyAppBridge();
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    // Only load App Bridge script if we detect embedded context
    const params = new URLSearchParams(window.location.search);
    const isEmbedded = window.self !== window.top && params.has("shop");

    if (isEmbedded && !scriptLoaded) {
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

  return (
    <EmbeddedAppContext.Provider value={appBridge}>
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
