import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Store, CheckCircle, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ConnectionStep {
  step: 'checking' | 'processing-callback' | 'exchanging-token' | 'saving' | 'done' | 'error';
  message: string;
}

export default function ShopifyConnect() {
  const [shop, setShop] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [connected, setConnected] = useState(false);
  const [connectionStep, setConnectionStep] = useState<ConnectionStep | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Pre-flight check for edge function availability
  const checkEdgeFunctionHealth = async (): Promise<boolean> => {
    try {
      console.log('[ShopifyConnect] Checking edge function health...');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-oauth?action=health`,
        { method: 'GET' }
      );
      
      if (response.status === 404) {
        console.error('[ShopifyConnect] Edge function not found (404)');
        return false;
      }
      
      const data = await response.json();
      console.log('[ShopifyConnect] Health check response:', data);
      return data.status === 'ok';
    } catch (error) {
      console.error('[ShopifyConnect] Health check failed:', error);
      return false;
    }
  };

  // Check if already connected or handle OAuth callback
  useEffect(() => {
    const checkConnection = async () => {
      if (!user) {
        setChecking(false);
        return;
      }

      // Handle OAuth callback
      const code = searchParams.get('code');
      const shopParam = searchParams.get('shop');
      const state = searchParams.get('state');

      if (code && shopParam && state) {
        console.log('[ShopifyConnect] OAuth callback detected');
        console.log('[ShopifyConnect] Params:', { code: code.substring(0, 10) + '...', shop: shopParam, hasState: !!state });
        
        setLoading(true);
        setConnectionStep({ step: 'processing-callback', message: 'Processing OAuth callback...' });
        
        try {
          // Decode state for debugging
          try {
            const decodedState = JSON.parse(atob(state));
            console.log('[ShopifyConnect] Decoded state:', decodedState);
          } catch (e) {
            console.error('[ShopifyConnect] Could not decode state:', e);
          }

          setConnectionStep({ step: 'exchanging-token', message: 'Exchanging authorization code...' });

          // Check edge function is accessible first
          const isHealthy = await checkEdgeFunctionHealth();
          if (!isHealthy) {
            throw new Error('Edge function is not accessible. Please try again or contact support.');
          }

          // Call callback endpoint
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
            // Clear URL params and redirect
            window.history.replaceState({}, '', '/connect-shopify');
            setTimeout(() => navigate('/dashboard'), 1500);
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
            navigate('/dashboard');
          }
        }
      } catch (error) {
        console.error('Error checking connection:', error);
      } finally {
        setChecking(false);
      }
    };

    checkConnection();
  }, [user, searchParams, navigate, toast]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: "Not authenticated",
        description: "Please sign in first",
        variant: "destructive",
      });
      navigate('/auth');
      return;
    }

    setLoading(true);
    setErrorDetails(null);
    setConnectionStep({ step: 'checking', message: 'Verifying edge function...' });

    try {
      // Pre-flight check
      const isHealthy = await checkEdgeFunctionHealth();
      if (!isHealthy) {
        throw new Error('The OAuth service is currently unavailable. Please try again in a moment or check Settings > Developer Test Mode for diagnostics.');
      }

      // Get brand_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('brand_id')
        .eq('id', user.id)
        .single();

      if (!profile?.brand_id) {
        throw new Error('Brand not found');
      }

      // Format shop domain
      let shopDomain = shop.trim().toLowerCase();
      if (!shopDomain.includes('.myshopify.com')) {
        shopDomain = `${shopDomain}.myshopify.com`;
      }

      // Create state with brand_id
      const state = btoa(JSON.stringify({ brand_id: profile.brand_id }));
      const redirectUri = `${window.location.origin}/connect-shopify`;

      console.log('[ShopifyConnect] Initiating OAuth flow:', { shopDomain, redirectUri, brandId: profile.brand_id });

      // Get auth URL from edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-oauth?action=authorize&shop=${encodeURIComponent(shopDomain)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`,
        { method: 'GET' }
      );

      console.log('[ShopifyConnect] Auth URL response status:', response.status);
      const result = await response.json();
      console.log('[ShopifyConnect] Auth URL result:', result);

      if (result.authUrl) {
        // Redirect to Shopify OAuth
        console.log('[ShopifyConnect] Redirecting to Shopify...');
        window.location.href = result.authUrl;
      } else {
        throw new Error(result.error || 'Failed to get authorization URL');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to initiate Shopify connection";
      console.error('[ShopifyConnect] Connection error:', error);
      setConnectionStep({ step: 'error', message: errorMsg });
      toast({
        title: "Connection failed",
        description: errorMsg,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

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
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 rounded-xl bg-primary-foreground/10 backdrop-blur-sm">
              <Sparkles className="h-8 w-8" />
            </div>
            <span className="text-2xl font-display font-semibold">AI Stylist</span>
          </div>
          
          <h1 className="text-5xl font-display font-bold leading-tight mb-6">
            Connect Your
            <br />
            Shopify Store
          </h1>
          
          <p className="text-lg text-primary-foreground/80 max-w-md">
            Link your Shopify store to start creating AI-powered outfit recommendations for your customers.
          </p>

          <div className="mt-12 space-y-4">
            <div className="flex items-center gap-3 text-primary-foreground/70">
              <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground/50" />
              <span>Sync your product catalog automatically</span>
            </div>
            <div className="flex items-center gap-3 text-primary-foreground/70">
              <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground/50" />
              <span>Create AI outfit recommendations</span>
            </div>
            <div className="flex items-center gap-3 text-primary-foreground/70">
              <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground/50" />
              <span>Embed widget on your store</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-xl font-display font-semibold">AI Stylist</span>
          </div>

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 mb-4">
              <Store className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-3xl font-display font-bold text-foreground">
              Connect Shopify
            </h2>
            <p className="mt-2 text-muted-foreground">
              Enter your Shopify store URL to get started
            </p>
          </div>

          {/* Error Alert */}
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

          <form onSubmit={handleConnect} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="shop" className="text-sm font-medium">
                Store URL
              </Label>
              <div className="relative">
                <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="shop"
                  type="text"
                  placeholder="mystore"
                  value={shop}
                  onChange={(e) => setShop(e.target.value)}
                  required
                  className="pl-10 pr-32"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  .myshopify.com
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter just your store name (e.g., "mystore" not "mystore.myshopify.com")
              </p>
            </div>

            <Button type="submit" className="w-full h-11 font-medium" disabled={loading || !shop.trim()}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {connectionStep?.message || 'Connecting...'}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Connect Store
                  <ExternalLink className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-8 p-4 rounded-lg bg-muted/50 border border-border">
            <h3 className="font-medium text-sm mb-2">What happens next?</h3>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>You'll be redirected to Shopify to authorize</li>
              <li>Grant read access to your products</li>
              <li>Return here to start creating outfits</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
