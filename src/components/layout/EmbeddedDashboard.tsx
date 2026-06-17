import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useEmbeddedApp } from "@/components/EmbeddedAppProvider";
import { EmbeddedTestModeBanner } from "@/components/embedded/EmbeddedTestModeBanner";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Package, Settings2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/embedded", icon: LayoutDashboard },
  { label: "Catalog", path: "/embedded/catalog", icon: Package },
  { label: "Rules", path: "/embedded/rules", icon: Settings2 },
  { label: "Settings", path: "/embedded/settings", icon: Settings },
];

const BRAND_FETCH_TIMEOUT_MS = 3000;

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
  const { config } = useEmbeddedApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [brand, setBrand] = useState<BrandInfo | null>(null);

  const shop = shopDomain || config?.shop;

  // Preserve shop/host params when navigating between embedded sub-routes.
  const navigateTo = (path: string) => {
    const qs = searchParams.toString();
    const target = qs ? `${path}?${qs}` : path;
    console.log('[EmbeddedDashboard] nav click — target:', target, 'current:', location.pathname);
    navigate(target);
  };

  const isActive = (path: string) =>
    path === "/embedded"
      ? location.pathname === "/embedded" || location.pathname === "/embedded/"
      : location.pathname.startsWith(path);

  useEffect(() => {
    let cancelled = false;

    if (testMode && !shop) {
      setBrand({ id: 'test-brand', name: 'Test Store', shopify_store_domain: 'test-store.myshopify.com' });
      return;
    }

    if (!shop) return;

    // Brand name is cosmetic — never block the UI waiting for it.
    // Race the Supabase query against a 3-second timeout; whichever resolves
    // first wins. If the query hangs (e.g. RLS with no auth session), the
    // timeout resolves with null and the app loads with no brand name shown.
    const shopDomainClean = shop.replace('.myshopify.com', '');

    const fetchPromise = supabase
      .from('brands')
      .select('id, name, shopify_store_domain')
      .or(`shopify_store_domain.eq.${shop},shopify_store_domain.ilike.%${shopDomainClean}%`)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.warn('[EmbeddedDashboard] brand fetch error:', error.message);
          return null;
        }
        return data as BrandInfo | null;
      })
      .catch((err) => {
        console.warn('[EmbeddedDashboard] brand fetch threw:', err);
        return null;
      });

    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => {
        console.warn('[EmbeddedDashboard] brand fetch exceeded 3s — continuing without brand name');
        resolve(null);
      }, BRAND_FETCH_TIMEOUT_MS)
    );

    console.log('[EmbeddedDashboard] fetching brand for shop:', shop);

    Promise.race([fetchPromise, timeoutPromise]).then((result) => {
      if (cancelled) return;
      if (result) {
        console.log('[EmbeddedDashboard] brand loaded:', result.name);
        setBrand(result);
      }
      // null result (timeout or no match) → brand stays null, UI already rendered
    });

    return () => { cancelled = true; };
  }, [shop, testMode]);

  return (
    <div className="min-h-screen bg-background">
      {testMode && <EmbeddedTestModeBanner shopDomain={shop} />}

      <div className="border-b bg-card/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">STYLYS</h1>
          {brand && (
            <span className="text-sm text-muted-foreground">{brand.name}</span>
          )}
        </div>
      </div>

      {/* Tab navigation — uses useNavigate on buttons (no href) so Shopify App Bridge
          cannot intercept clicks and trigger a full-page top-frame navigation. */}
      <nav className="border-b bg-background px-4">
        <div className="flex">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              onClick={() => navigateTo(item.path)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                isActive(item.path)
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="p-4">{children}</main>
    </div>
  );
}
