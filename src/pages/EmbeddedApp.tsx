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
  // Test mode is only allowed in non-production builds to prevent shop-verification bypass.
  const isTestMode = searchParams.get("test") === "true" && import.meta.env.DEV;

  useEffect(() => {
    const verifyShop = async () => {
      if (isTestMode) {
        setVerified(true);
        setVerifying(false);
        return;
      }

      if (!shop) {
        setNeedsConnection(true);
        setVerifying(false);
        return;
      }

      try {
        // Use edge function to verify (bypasses RLS, works without auth)
        const shopDomain = shop.includes('.myshopify.com') ? shop : `${shop}.myshopify.com`;
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-oauth?action=verify-shop&shop=${encodeURIComponent(shopDomain)}`
        );
        const result = await res.json();

        if (result.connected) {
          setVerified(true);
        } else {
          setNeedsConnection(true);
        }
      } catch (err) {
        console.error('Verification error:', err);
        setNeedsConnection(true);
      } finally {
        setVerifying(false);
      }
    };

    verifyShop();
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
