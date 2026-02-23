import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useEmbeddedApp } from "@/components/EmbeddedAppProvider";
import { EmbeddedDashboard } from "@/components/layout/EmbeddedDashboard";
import { EmbeddedConnectionRequired } from "@/components/embedded/EmbeddedConnectionRequired";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "./Dashboard";

export default function EmbeddedApp() {
  const [searchParams] = useSearchParams();
  const { config } = useEmbeddedApp();
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [needsConnection, setNeedsConnection] = useState(false);

  const shop = searchParams.get("shop") || config?.shop;
  const isTestMode = searchParams.get("test") === "true";

  useEffect(() => {
    const verifyShop = async () => {
      // Test mode bypasses verification
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
        // Verify this shop exists in our system
        const shopDomain = shop.replace('.myshopify.com', '');
        const { data, error: dbError } = await supabase
          .from('brands')
          .select('id, name')
          .or(`shopify_store_domain.eq.${shop},shopify_store_domain.ilike.%${shopDomain}%`)
          .maybeSingle();

        if (dbError) {
          console.error('Error verifying shop:', dbError);
          setNeedsConnection(true);
        } else if (!data) {
          // Store not connected yet - show connection required UI
          setNeedsConnection(true);
        } else {
          setVerified(true);
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

  // Loading state
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

  // Connection required state - auto-initiate OAuth if shop is known
  if (needsConnection) {
    return <EmbeddedConnectionRequired shopDomain={shop} autoInitiate={!!shop} />;
  }

  // Verified or test mode - render embedded dashboard
  if (verified) {
    return (
      <EmbeddedDashboard testMode={isTestMode} shopDomain={shop}>
        <Dashboard />
      </EmbeddedDashboard>
    );
  }

  return null;
}
