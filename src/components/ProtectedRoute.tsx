import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireShopify?: boolean;
}

const SUB_CACHE_KEY = 'stylys:sub-status';
const SUB_CACHE_TTL_MS = 5 * 60 * 1000;

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

const EMBEDDED_FLAG_KEY = 'stylys:embedded-session';

function isRunningEmbedded(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    const shopParam = params.get('shop');
    const inIframe = window.self !== window.top;

    // Persist embedded flag for the session once detected so client-side
    // navigation (which drops the shop query param) still counts as embedded.
    if (inIframe && (shopParam || window.location.pathname.startsWith('/embedded'))) {
      try { sessionStorage.setItem(EMBEDDED_FLAG_KEY, '1'); } catch { /* ignore */ }
      return true;
    }

    try {
      if (sessionStorage.getItem(EMBEDDED_FLAG_KEY) === '1' && inIframe) return true;
    } catch { /* ignore */ }

    return false;
  } catch {
    return false;
  }
}

export function ProtectedRoute({ children, requireShopify = true }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  const [hasShopify, setHasShopify] = useState<boolean | null>(null);
  const [hasSub, setHasSub] = useState<boolean | null>(null);
  const [startupDone, setStartupDone] = useState(false);
  const timeoutFired = useRef(false);

  const embedded = isRunningEmbedded();

  // Standalone auth flow — hooks must be called before any early return (React rules).
  // The effect body exits immediately when running embedded.
  useEffect(() => {
    if (embedded) return;
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
    }, 3000);

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

    Promise.all([checkShopify(), checkSub()]).then(([shopifyResult, subResult]) => {
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
  }, [embedded, user, loading, requireShopify, location.pathname]);

  // Render immediately when running inside the Shopify admin iframe.
  if (embedded) {
    return <>{children}</>;
  }

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
