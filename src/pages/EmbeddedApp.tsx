import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useEmbeddedApp } from "@/components/EmbeddedAppProvider";
import { EmbeddedDashboard } from "@/components/layout/EmbeddedDashboard";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "./Dashboard";

export default function EmbeddedApp() {
  const [searchParams] = useSearchParams();
  const { isEmbedded, config } = useEmbeddedApp();
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shop = searchParams.get("shop") || config?.shop;

  useEffect(() => {
    const verifyShop = async () => {
      if (!shop) {
        setError("Missing shop parameter");
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
          setError("Failed to verify store");
        } else if (!data) {
          setError("Store not found. Please complete the OAuth connection first.");
        } else {
          setVerified(true);
        }
      } catch (err) {
        console.error('Verification error:', err);
        setError("Verification failed");
      } finally {
        setVerifying(false);
      }
    };

    verifyShop();
  }, [shop]);

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

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <span className="text-destructive text-xl">!</span>
          </div>
          <h1 className="text-xl font-semibold">Unable to Load App</h1>
          <p className="text-muted-foreground">{error}</p>
          <p className="text-sm text-muted-foreground">
            Shop: <code className="bg-muted px-1 rounded">{shop || 'not provided'}</code>
          </p>
        </div>
      </div>
    );
  }

  // Verified - render embedded dashboard
  if (verified) {
    return (
      <EmbeddedDashboard>
        <Dashboard />
      </EmbeddedDashboard>
    );
  }

  return null;
}
