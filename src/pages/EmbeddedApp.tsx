import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useEmbeddedApp } from "@/components/EmbeddedAppProvider";
import { EmbeddedDashboard } from "@/components/layout/EmbeddedDashboard";
import { EmbeddedConnectionRequired } from "@/components/embedded/EmbeddedConnectionRequired";
import Dashboard from "./Dashboard";

export default function EmbeddedApp() {
  const [searchParams] = useSearchParams();
  const { config } = useEmbeddedApp();
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [needsConnection, setNeedsConnection] = useState(false);

  const shop = searchParams.get("shop") || config?.shop;
  const host = searchParams.get("host");
  // Test mode is only allowed in non-production builds to prevent shop-verification bypass.
  const isTestMode = searchParams.get("test") === "true" && import.meta.env.DEV;

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      if (shop && host) {
        console.warn('[EmbeddedApp] Verification timed out after 3s, but shop+host present — treating as verified inside Shopify admin');
        cancelled = true;
        setVerified(true);
        setVerifying(false);
        return;
      }
      console.warn('[EmbeddedApp] Verification timed out after 3s, falling back to connection screen');
      cancelled = true;
      setNeedsConnection(true);
      setVerifying(false);
    }, 3000);

    const verifyShop = async () => {
      if (isTestMode) {
        if (cancelled) return;
        cancelled = true;
        window.clearTimeout(timeoutId);
        setVerified(true);
        setVerifying(false);
        return;
      }

      if (shop && host) {
        if (cancelled) return;
        cancelled = true;
        window.clearTimeout(timeoutId);
        setVerified(true);
        setVerifying(false);
        return;
      }

      if (!shop) {
        if (cancelled) return;
        cancelled = true;
        window.clearTimeout(timeoutId);
        setNeedsConnection(true);
        setVerifying(false);
        return;
      }

      try {
        const shopDomain = shop.includes('.myshopify.com') ? shop : `${shop}.myshopify.com`;
        const controller = new AbortController();
        const fetchTimeout = window.setTimeout(() => controller.abort(), 2800);
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-oauth?action=verify-shop&shop=${encodeURIComponent(shopDomain)}`,
          { signal: controller.signal }
        );
        window.clearTimeout(fetchTimeout);
        const result = await res.json();
        if (cancelled) return;
        cancelled = true;
        window.clearTimeout(timeoutId);

        if (result.connected) {
          setVerified(true);
        } else {
          setNeedsConnection(true);
        }
      } catch (err) {
        if (cancelled) return;
        cancelled = true;
        window.clearTimeout(timeoutId);
        console.error('Verification error:', err);
        setNeedsConnection(true);
      } finally {
        setVerifying(false);
      }
    };

    verifyShop();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [shop, isTestMode]);

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading STYLYS...</p>
        </div>
      </div>
    );
  }

  if (needsConnection) {
    return <EmbeddedConnectionRequired shopDomain={shop} autoInitiate={!!shop} />;
  }

  if (verified) {
    return (
      <EmbeddedDashboard testMode={isTestMode} shopDomain={shop}>
        <Dashboard />
      </EmbeddedDashboard>
    );
  }

  return null;
}
