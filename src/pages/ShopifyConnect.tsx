import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Store, CheckCircle, Loader2, ExternalLink, AlertCircle, Settings } from 'lucide-react';
import stylysIconCream from '@/assets/stylys-icon-cream.png';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ConnectionStep {
  step: 'checking' | 'processing-callback' | 'exchanging-token' | 'saving' | 'done' | 'error';
  message: string;
}

export default function ShopifyConnect() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [connected, setConnected] = useState(false);
  const [connectionStep, setConnectionStep] = useState<ConnectionStep | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const callbackProcessed = useRef(false);

  const isEmbeddedFlow = searchParams.get('embedded') === 'true';

  // Check if already connected or handle OAuth callback
  useEffect(() => {
    const checkConnection = async () => {
      // Handle OAuth callback (Shopify redirects back here with code+shop+state)
      const code = searchParams.get('code');
      const shopParam = searchParams.get('shop');
      const state = searchParams.get('state');

      if (code && shopParam && state) {
        // Guard: prevent double-execution (React StrictMode / re-renders)
        if (callbackProcessed.current) return;
        callbackProcessed.current = true;

        // Immediately clear URL params to prevent re-triggering
        window.history.replaceState({}, '', '/connect-shopify');

        console.log('[ShopifyConnect] OAuth callback detected');
        console.log('[ShopifyConnect] Params:', { code: code.substring(0, 10) + '...', shop: shopParam, hasState: !!state });

        setLoading(true);
        setConnectionStep({ step: 'processing-callback', message: 'Processing OAuth callback...' });

        try {
          const decodedState = JSON.parse(atob(state));
          console.log('[ShopifyConnect] Decoded state:', decodedState);
        } catch (e) {
          console.error('[ShopifyConnect] Could not decode state:', e);
        }

        try {
          setConnectionStep({ step: 'exchanging-token', message: 'Exchanging authorization code...' });

          const callbackUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-oauth?action=callback&code=${encodeURIComponent(code)}&shop=${encodeURIComponent(shopParam)}&state=${encodeURIComponent(state)}`;
          console.log('[ShopifyConnect] Calling callback URL...');

          const response = await fetch(callbackUrl, { method: 'GET' });
          console.log('[ShopifyConnect] Callback response status:', response.status);

          const result = await response.json();
          console.log('[ShopifyConnect] Callback result:', result);

          if (result.success) {
            setConnectionStep({ step: 'done', message: 'Connection successful!' });
            toast({
              title: "Shopify Connected!",
              description: `Successfully connected to ${result.shop}`,
            });
            setConnected(true);

            // Redirect back to Shopify Admin with the app open
            sessionStorage.removeItem('selectedPlan');
            const shopName = shopParam.replace('.myshopify.com', '');
            const adminUrl = `https://admin.shopify.com/store/${shopName}/apps/stylys-app`;
            setTimeout(() => {
              if (window.top && window.top !== window.self) {
                window.top.location.href = adminUrl;
              } else {
                window.location.href = adminUrl;
              }
            }, 1500);
          } else {
            const errorMsg = result.error || "Failed to connect Shopify store";
            console.error('[ShopifyConnect] Callback error:', errorMsg, result.details);
            setConnectionStep({ step: 'error', message: errorMsg });
            setErrorDetails(result.details || null);
            toast({
              title: "Connection failed",
              description: errorMsg,
              variant: "destructive",
            });
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "An error occurred during Shopify connection";
          console.error('[ShopifyConnect] Callback exception:', error);
          setConnectionStep({ step: 'error', message: errorMsg });
          toast({
            title: "Connection failed",
            description: errorMsg,
            variant: "destructive",
          });
        } finally {
          setLoading(false);
          setChecking(false);
        }
        return;
      }

      // Not a callback; require user session for the "already connected" check
      if (!user) {
        setChecking(false);
        return;
      }

      setChecking(false);

      // Check if already connected
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('brand_id')
          .eq('id', user.id)
          .single();

        if (profile?.brand_id) {
          const { data: brand } = await supabase
            .from('brands')
            .select('shopify_store_domain, shopify_connected_at')
            .eq('id', profile.brand_id)
            .single();

          if (brand?.shopify_connected_at) {
            setConnected(true);
            if (isEmbeddedFlow && brand.shopify_store_domain) {
              const shopName = brand.shopify_store_domain.replace('.myshopify.com', '');
              window.location.href = `https://admin.shopify.com/store/${shopName}/apps/stylys-app`;
            } else {
              navigate('/dashboard');
            }
          }
        }
      } catch (error) {
        console.error('Error checking connection:', error);
      }
    };

    checkConnection();
  }, [user, searchParams, navigate, toast, isEmbeddedFlow]);

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Checking connection status...</span>
        </div>
      </div>
    );
  }

  // Show processing state during OAuth callback
  if (connectionStep && connectionStep.step !== 'error' && loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <h2 className="text-xl font-display font-bold">{connectionStep.message}</h2>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <div className="flex gap-1">
              {['processing-callback', 'exchanging-token', 'saving', 'done'].map((step, i) => (
                <div
                  key={step}
                  className={`w-2 h-2 rounded-full ${
                    connectionStep.step === step ? 'bg-primary' :
                    ['processing-callback', 'exchanging-token', 'saving', 'done'].indexOf(connectionStep.step) > i
                      ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (connected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-display font-bold">Shopify Connected!</h2>
          <p className="text-muted-foreground">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80" />
        <div className="relative z-10 flex flex-col justify-center px-16 text-primary-foreground">
          <Link to="/" className="flex items-center gap-3 mb-8">
            <div className="p-2 rounded-xl bg-primary-foreground/10 backdrop-blur-sm">
              <img src={stylysIconCream} alt="STYLYS" className="h-16 w-16 object-contain" />
            </div>
            <span className="text-2xl font-display font-semibold">STYLYS</span>
          </Link>

          <h1 className="text-5xl font-display font-bold leading-tight mb-6">
            Connect Your
            <br />
            Shopify Store
          </h1>

          <p className="text-lg text-primary-foreground/80 max-w-md">
            Link your store and start generating AI-powered outfit recommendations for your customers in minutes.
          </p>

          <div className="mt-12 space-y-4">
            <div className="flex items-center gap-3 text-primary-foreground/70">
              <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground/50" />
              <span>Automatically sync your entire product catalog</span>
            </div>
            <div className="flex items-center gap-3 text-primary-foreground/70">
              <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground/50" />
              <span>Generate AI-powered outfit recommendations</span>
            </div>
            <div className="flex items-center gap-3 text-primary-foreground/70">
              <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground/50" />
              <span>Let customers virtually try on outfits before they buy</span>
            </div>
            <div className="flex items-center gap-3 text-primary-foreground/70">
              <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground/50" />
              <span>Add the styling widget to your storefront</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Install instructions */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-xl font-display font-semibold">STYLYS</span>
          </div>

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 mb-4">
              <Store className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-3xl font-display font-bold text-foreground">
              Connect Your Store
            </h2>
            <p className="mt-2 text-muted-foreground">
              Install STYLYS from the Shopify App Store to get started.
            </p>
          </div>

          {connectionStep?.step === 'error' && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">{connectionStep.message}</p>
                {errorDetails && (
                  <p className="text-xs mt-1 opacity-80">{errorDetails}</p>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <Button className="w-full h-11 font-medium" asChild>
              <a
                href="https://apps.shopify.com/stylys"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Install from Shopify App Store
              </a>
            </Button>

            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <h3 className="font-medium text-sm mb-2">Already installed?</h3>
              <p className="text-sm text-muted-foreground">
                Open STYLYS from your{' '}
                <a
                  href="https://admin.shopify.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Shopify Admin
                </a>
                {' '}— Shopify will connect your store automatically.
              </p>
            </div>
          </div>

          {import.meta.env.DEV && (
            <div className="mt-4 p-4 rounded-lg border border-dashed border-border bg-background">
              <div className="flex items-start gap-3">
                <Settings className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <h3 className="font-medium text-sm mb-1">Developer Test Mode</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Use Developer Test Mode to create a mock connection and test the dashboard without real OAuth.
                  </p>
                  <Link
                    to="/settings"
                    className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Go to Settings → Developer Test Mode
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
