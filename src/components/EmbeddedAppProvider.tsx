import { createContext, useContext, ReactNode } from "react";
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
