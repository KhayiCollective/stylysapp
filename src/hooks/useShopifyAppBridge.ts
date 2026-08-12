import { useState, useEffect, useCallback } from "react";

declare global {
  interface Window {
    shopify?: {
      config: {
        shop: string;
        host: string;
        apiKey: string;
      };
      idToken: () => Promise<string>;
      toast: {
        show: (message: string, options?: { duration?: number; isError?: boolean }) => void;
      };
      loading: (isLoading: boolean) => void;
      fullscreen: {
        enter: () => void;
        exit: () => void;
      };
    };
  }
}

export interface AppBridgeConfig {
  shop: string;
  host: string;
  isEmbedded: boolean;
}

export function useShopifyAppBridge() {
  const [config, setConfig] = useState<AppBridgeConfig | null>(null);
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Detect if we're running embedded in Shopify Admin
    const params = new URLSearchParams(window.location.search);
    const shop = params.get("shop");
    const host = params.get("host");
    const embedded = window.self !== window.top;

    if (embedded && shop && host) {
      setIsEmbedded(true);
      setConfig({
        shop,
        host,
        isEmbedded: true,
      });
    }

    setLoading(false);
  }, []);

  // Stable identities: these close over window.shopify (not React state), so
  // an empty dep array is correct. Downstream hooks (useEmbeddedInvoke,
  // useSubscription) depend on getSessionToken in effect/callback deps —
  // an unstable reference here causes those effects to re-fire on every
  // render, which previously caused the billing card to flicker.
  const showToast = useCallback((message: string, isError = false) => {
    if (window.shopify?.toast) {
      window.shopify.toast.show(message, { isError });
    }
  }, []);

  const setAppLoading = useCallback((isLoading: boolean) => {
    if (window.shopify?.loading) {
      window.shopify.loading(isLoading);
    }
  }, []);

  const getSessionToken = useCallback(async (): Promise<string | null> => {
    if (window.shopify?.idToken) {
      try {
        return await window.shopify.idToken();
      } catch (error) {
        console.error("Error getting session token:", error);
        return null;
      }
    }
    return null;
  }, []);

  const enterFullscreen = useCallback(() => {
    if (window.shopify?.fullscreen) {
      window.shopify.fullscreen.enter();
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    if (window.shopify?.fullscreen) {
      window.shopify.fullscreen.exit();
    }
  }, []);

  return {
    config,
    isEmbedded,
    loading,
    showToast,
    setAppLoading,
    getSessionToken,
    enterFullscreen,
    exitFullscreen,
  };
}
