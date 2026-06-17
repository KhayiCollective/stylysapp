import { ReactNode, useEffect, useState } from "react";
import { useEmbeddedApp } from "@/components/EmbeddedAppProvider";
import { EmbeddedTestModeBanner } from "@/components/embedded/EmbeddedTestModeBanner";
import { supabase } from "@/integrations/supabase/client";

interface EmbeddedDashboardProps {
  children: ReactNode;
  testMode?: boolean;
  shopDomain?: string | null;
}

interface BrandInfo {
  id: string;
  name: string;
  shopify_store_domain: string | null;
}

export function EmbeddedDashboard({ children, testMode = false, shopDomain }: EmbeddedDashboardProps) {
  const { config, showToast } = useEmbeddedApp();
  const [brand, setBrand] = useState<BrandInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const shop = shopDomain || config?.shop;

  useEffect(() => {
    let cancelled = false;

    console.log('[EmbeddedDashboard] mount, shop:', shop, 'testMode:', testMode);

    // Safety timeout: never spin longer than 4s, regardless of network state.
    const safetyTimer = setTimeout(() => {
      if (cancelled) return;
      console.warn('[EmbeddedDashboard] safety timeout reached - releasing spinner');
      setLoading(false);
    }, 4000);

    const fetchBrandByShop = async () => {
      // In test mode with no real shop, use mock data
      if (testMode && !shop) {
        setBrand({
          id: 'test-brand',
          name: 'Test Store',
          shopify_store_domain: 'test-store.myshopify.com'
        });
        setLoading(false);
        return;
      }

      if (!shop) {
        console.log('[EmbeddedDashboard] no shop - releasing spinner');
        setLoading(false);
        return;
      }

      try {
        const shopDomainClean = shop.replace('.myshopify.com', '');
        console.log('[EmbeddedDashboard] fetching brand for shop:', shop);
        const { data, error } = await supabase
          .from('brands')
          .select('id, name, shopify_store_domain')
          .or(`shopify_store_domain.eq.${shop},shopify_store_domain.ilike.%${shopDomainClean}%`)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.error('[EmbeddedDashboard] Error fetching brand:', error);
          if (!testMode) {
            showToast('Could not load store data', true);
          }
          if (testMode) {
            setBrand({
              id: 'test-brand',
              name: shop.replace('.myshopify.com', ''),
              shopify_store_domain: shop
            });
          }
        } else if (data) {
          console.log('[EmbeddedDashboard] brand loaded:', data.id);
          setBrand(data);
        } else {
          console.warn('[EmbeddedDashboard] no brand row matched shop:', shop);
        }
      } catch (err) {
        console.error('[EmbeddedDashboard] Error in fetchBrandByShop:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchBrandByShop();

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
    };
  }, [shop, showToast, testMode]);


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading STYLYS...</p>
        </div>
      </div>
    );
  }

  // Embedded layout - minimal chrome since Shopify provides navigation
  return (
    <div className="min-h-screen bg-background">
      {/* Test mode banner */}
      {testMode && <EmbeddedTestModeBanner shopDomain={shop} />}
      
      <div className="border-b bg-card/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">STYLYS</h1>
            {brand && (
              <span className="text-sm text-muted-foreground">
                {brand.name}
              </span>
            )}
          </div>
        </div>
      </div>
      <main className="p-4">
        {children}
      </main>
    </div>
  );
}
