import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEmbeddedApp } from '@/components/EmbeddedAppProvider';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireShopify?: boolean;
}

const SUB_CACHE_KEY = 'stylys:sub-status';
const SUB_CACHE_TTL_MS = 5 * 60 * 1000;
const STARTUP_TIMEOUT_MS = 3000;

function readSubCache(userId: string): boolean | null {
  try {
    const raw = localStorage.getItem(SUB_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId: string; subscribed: boolean; ts: number };
    if (parsed.userId !== userId) return null;
    if (Date.now() - parsed.ts > SUB_CACHE_TTL_MS) return null;
    return !!parsed.subscribed;
  } catch {
    return null;
  }
}

function writeSubCache(userId: string, subscribed: boolean) {
  try {
    localStorage.setItem(SUB_CACHE_KEY, JSON.stringify({ userId, subscribed, ts: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function ProtectedRoute({ children, requireShopify = true }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { isEmbedded, config } = useEmbeddedApp();
  const location = useLocation();

  const [startupDone, setStartupDone] = useState(false);
  const [hasShopify, setHasShopify] = useState<boolean | null>(null);
  const [hasSub, setHasSub] = useState<boolean | null>(null);
  const [embeddedBrandVerified, setEmbeddedBrandVerified] = useState<boolean | null>(null);
  const timeoutFired = useRef(false);

  // Embedded shop verification + subscription/Shopify checks run in parallel with a 3s startup cap.
  useEffect(() => {
    if (loading) return;

    let cancelled = false;
    timeoutFired.current = false;
    setStartupDone(false);

    const SUB_EXEMPT = ['/connect-shopify', '/settings', '/shopify-setup'];
    const exempt = SUB_EXEMPT.includes(location.pathname);

    // Seed from cache immediately so UI can show dashboard without waiting.
    if (user && requireShopify) {
      const cached = readSubCache(user.id);
      if (cached !== null) setHasSub(cached);
    }

    // Hard 3s cap: render the dashboard anyway; remaining checks continue in background.
    const startupTimer = window.setTimeout(() => {
      if (cancelled) return;
      timeoutFired.current = true;
      console.warn('[ProtectedRoute] Startup checks exceeded 3s — rendering dashboard, continuing in background');
      setStartupDone(true);
    }, STARTUP_TIMEOUT_MS);

    const verifyEmbedded = async () => {
      if (!isEmbedded || !config?.shop) return;
      try {
        const shopDomain = config.shop.includes('.myshopify.com') ? config.shop : `${config.shop}.myshopify.com`;
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-oauth?action=verify-shop&shop=${encodeURIComponent(shopDomain)}`
        );
        const result = await res.json();
        if (!cancelled) setEmbeddedBrandVerified(!!result.connected);
      } catch (err) {
        console.error('[ProtectedRoute] verify-shop error:', err);
        if (!cancelled) setEmbeddedBrandVerified(false);
      }
    };

    const checkShopify = async (): Promise<boolean | null> => {
      if (!user || !requireShopify) return null;
      if (location.pathname === '/connect-shopify') return true;
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('brand_id')
          .eq('id', user.id)
          .single();
        if (!profile?.brand_id) return false;
        const { data: brand } = await supabase
          .from('brands')
          .select('shopify_connected_at')
          .eq('id', profile.brand_id)
          .single();
        return !!brand?.shopify_connected_at;
      } catch (err) {
        console.error('[ProtectedRoute] Shopify check error:', err);
        return false;
      }
    };

    const checkSub = async (): Promise<boolean | null> => {
      if (!user || !requireShopify || exempt) return null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return false;
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-subscription`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        const result = await res.json();
        console.log('[ProtectedRoute] check-subscription response', { status: res.status, result });
        return !!result?.subscribed;
      } catch (err) {
        console.error('[ProtectedRoute] check-subscription error:', err);
        return false;
      }
    };

    // Run all startup calls in parallel.
    Promise.all([verifyEmbedded(), checkShopify(), checkSub()]).then(([, shopifyResult, subResult]) => {
      if (cancelled) return;
      if (shopifyResult !== null) setHasShopify(shopifyResult);
      if (subResult !== null) {
        setHasSub(subResult);
        if (user) writeSubCache(user.id, subResult);
      }
      window.clearTimeout(startupTimer);
      setStartupDone(true);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(startupTimer);
    };
  }, [user, loading, requireShopify, location.pathname, isEmbedded, config?.shop]);

  // Show loading while auth is resolving or before startup checks finish (or time out).
  if (loading || !startupDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Embedded path: if verification hasn't completed yet (timeout fired), optimistically render.
  if (isEmbedded && config?.shop) {
    if (embeddedBrandVerified === false) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center p-8">
            <h2 className="text-xl font-semibold mb-2">Store Not Connected</h2>
            <p className="text-muted-foreground">
              This Shopify store is not connected to STYLYS yet.
            </p>
          </div>
        </div>
      );
    }
    return <>{children}</>;
  }

  // Standalone auth flow
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Shopify connection gate — only enforce when we actually have an answer.
  if (requireShopify && hasShopify === false && location.pathname !== '/connect-shopify') {
    return <Navigate to="/connect-shopify" replace />;
  }

  // Subscription gate — only redirect when we have a definitive false (don't redirect on timeout/unknown).
  const SUB_EXEMPT = ['/connect-shopify', '/settings', '/shopify-setup'];
  const shouldRedirectToPlans =
    requireShopify &&
    hasShopify === true &&
    hasSub === false &&
    !SUB_EXEMPT.includes(location.pathname) &&
    !timeoutFired.current;

  if (shouldRedirectToPlans) {
    console.log('[ProtectedRoute] Redirecting to /auth?view=select-plan');
    return <Navigate to="/auth?view=select-plan" replace />;
  }

  return <>{children}</>;
}
