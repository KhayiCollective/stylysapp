import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEmbeddedApp } from '@/components/EmbeddedAppProvider';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireShopify?: boolean;
}

export function ProtectedRoute({ children, requireShopify = true }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { isEmbedded, config } = useEmbeddedApp();
  const location = useLocation();
  const [checkingShopify, setCheckingShopify] = useState(requireShopify);
  const [hasShopify, setHasShopify] = useState<boolean | null>(null);
  const [embeddedBrandVerified, setEmbeddedBrandVerified] = useState(false);
  const [checkingEmbedded, setCheckingEmbedded] = useState(true);

  // Handle embedded mode - verify shop exists in our system
  useEffect(() => {
    const verifyEmbeddedShop = async () => {
      if (!isEmbedded || !config?.shop) {
        setCheckingEmbedded(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('brands')
          .select('id')
          .eq('shopify_store_domain', config.shop)
          .single();

        setEmbeddedBrandVerified(!!data);
      } catch (error) {
        console.error('Error verifying embedded shop:', error);
        setEmbeddedBrandVerified(false);
      } finally {
        setCheckingEmbedded(false);
      }
    };

    verifyEmbeddedShop();
  }, [isEmbedded, config?.shop]);

  useEffect(() => {
    const checkShopifyConnection = async () => {
      if (!user || !requireShopify) {
        setCheckingShopify(false);
        return;
      }

      // Skip check if we're on the connect-shopify page
      if (location.pathname === '/connect-shopify') {
        setCheckingShopify(false);
        setHasShopify(true); // Allow access to connect page
        return;
      }

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('brand_id')
          .eq('id', user.id)
          .single();

        if (profile?.brand_id) {
          const { data: brand } = await supabase
            .from('brands')
            .select('shopify_connected_at')
            .eq('id', profile.brand_id)
            .single();

          setHasShopify(!!brand?.shopify_connected_at);
        } else {
          setHasShopify(false);
        }
      } catch (error) {
        console.error('Error checking Shopify connection:', error);
        setHasShopify(false);
      } finally {
        setCheckingShopify(false);
      }
    };

    if (user && requireShopify) {
      checkShopifyConnection();
    } else {
      setCheckingShopify(false);
    }
  }, [user, requireShopify, location.pathname]);

  // Show loading while checking auth state
  if (loading || checkingShopify || (isEmbedded && checkingEmbedded)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // If running embedded in Shopify Admin, bypass Supabase auth
  // Instead, verify the shop exists in our system
  if (isEmbedded && config?.shop) {
    if (embeddedBrandVerified) {
      return <>{children}</>;
    } else {
      // Shop not found in our system - show error
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
  }

  // Standard Supabase auth flow for standalone mode
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect to connect-shopify if Shopify is required but not connected
  if (requireShopify && hasShopify === false && location.pathname !== '/connect-shopify') {
    return <Navigate to="/connect-shopify" replace />;
  }

  return <>{children}</>;
}
