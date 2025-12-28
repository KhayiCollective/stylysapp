import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Store, CheckCircle, Loader2, ExternalLink } from 'lucide-react';

export default function ShopifyConnect() {
  const [shop, setShop] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [connected, setConnected] = useState(false);
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

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
        setLoading(true);
        try {
          const { data, error } = await supabase.functions.invoke('shopify-oauth', {
            body: null,
            headers: {},
          });

          // Use fetch directly for callback with query params
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-oauth?action=callback&code=${code}&shop=${shopParam}&state=${state}`,
            { method: 'GET' }
          );

          const result = await response.json();

          if (result.success) {
            toast({
              title: "Shopify Connected!",
              description: `Successfully connected to ${result.shop}`,
            });
            setConnected(true);
            // Clear URL params and redirect
            window.history.replaceState({}, '', '/connect-shopify');
            setTimeout(() => navigate('/dashboard'), 1500);
          } else {
            toast({
              title: "Connection failed",
              description: result.error || "Failed to connect Shopify store",
              variant: "destructive",
            });
          }
        } catch (error) {
          toast({
            title: "Connection failed",
            description: "An error occurred during Shopify connection",
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

    try {
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

      // Get auth URL from edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-oauth?action=authorize&shop=${encodeURIComponent(shopDomain)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`,
        { method: 'GET' }
      );

      const result = await response.json();

      if (result.authUrl) {
        // Redirect to Shopify OAuth
        window.location.href = result.authUrl;
      } else {
        throw new Error(result.error || 'Failed to get authorization URL');
      }
    } catch (error) {
      toast({
        title: "Connection failed",
        description: error instanceof Error ? error.message : "Failed to initiate Shopify connection",
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
                  Connecting...
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
