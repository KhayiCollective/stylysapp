import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, Loader2, Power, PowerOff, AlertTriangle, RefreshCw, Copy, Check, Code } from 'lucide-react';

export function WidgetStatus() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [scopeError, setScopeError] = useState(false);
  const [showManualInstall, setShowManualInstall] = useState(false);
  const [copied, setCopied] = useState(false);
  const [brandData, setBrandData] = useState<{
    id: string;
    shopify_store_domain: string | null;
    shopify_access_token: string | null;
    widget_script_tag_id: string | null;
  } | null>(null);

  useEffect(() => {
    const fetchBrand = async () => {
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('brand_id')
        .eq('id', user.id)
        .single();

      if (profile?.brand_id) {
        const { data: brand } = await supabase
          .from('brands')
          .select('id, shopify_store_domain, shopify_access_token, widget_script_tag_id')
          .eq('id', profile.brand_id)
          .single();

        setBrandData(brand as any);
      }
      setLoading(false);
    };
    fetchBrand();
  }, [user]);

  const isConnected = !!brandData?.shopify_store_domain;
  const isWidgetActive = !!brandData?.widget_script_tag_id;

  const handleReauthorize = async () => {
    if (!brandData?.shopify_store_domain) return;
    const shop = brandData.shopify_store_domain;
    const state = btoa(JSON.stringify({ brand_id: brandData.id }));
    const redirectUri = `${window.location.origin}/connect-shopify`;

    const { data, error } = await supabase.functions.invoke('shopify-oauth', {
      body: null,
      headers: {},
    });

    // Build the authorize URL directly
    const params = new URLSearchParams({
      action: 'authorize',
      shop,
      redirect_uri: redirectUri,
      state,
    });

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-oauth?${params.toString()}`
    );
    const json = await res.json();

    if (json.authUrl) {
      window.location.href = json.authUrl;
    } else {
      toast({
        title: 'Error',
        description: 'Could not start re-authorization. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleToggle = async () => {
    if (!brandData?.id) return;
    setToggling(true);
    setScopeError(false);

    try {
      const { data, error } = await supabase.functions.invoke('shopify-widget-toggle', {
        body: { brand_id: brandData.id, action: isWidgetActive ? 'remove' : 'install' },
      });

      // Check for scope error in response data FIRST (edge function returns data even on 403)
      if (data?.error === 'scope_error') {
        setScopeError(true);
        return;
      }

      // Refresh brand data
      const { data: updated } = await supabase
        .from('brands')
        .select('id, shopify_store_domain, shopify_access_token, widget_script_tag_id')
        .eq('id', brandData.id)
        .single();

      setBrandData(updated as any);

      toast({
        title: isWidgetActive ? 'Widget disabled' : 'Widget enabled',
        description: isWidgetActive
          ? 'The STYLYS widget has been removed from your store.'
          : 'The STYLYS widget is now live on your store!',
      });
    } catch (error: any) {
      // Parse the error message for scope issues
      const msg = error?.message || '';
      if (msg.includes('scope') || msg.includes('403')) {
        setScopeError(true);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to toggle widget. Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setToggling(false);
    }
  };

  if (loading) return null;
  if (!isConnected) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Storefront Widget
        </CardTitle>
        <CardDescription>
          The STYLYS AI styling widget on your Shopify store
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {scopeError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Your store needs to re-authorize with updated permissions to enable the widget.</span>
              <Button size="sm" variant="outline" onClick={handleReauthorize} className="ml-3 shrink-0">
                <RefreshCw className="h-4 w-4 mr-2" />
                Re-authorize
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Status:</span>
            {isWidgetActive ? (
              <Badge variant="default" className="bg-primary">Active</Badge>
            ) : (
              <Badge variant="secondary">Inactive</Badge>
            )}
          </div>
          <Button
            variant={isWidgetActive ? 'destructive' : 'default'}
            size="sm"
            onClick={handleToggle}
            disabled={toggling}
          >
            {toggling ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : isWidgetActive ? (
              <PowerOff className="h-4 w-4 mr-2" />
            ) : (
              <Power className="h-4 w-4 mr-2" />
            )}
            {isWidgetActive ? 'Disable Widget' : 'Enable Widget'}
          </Button>
        </div>
        {isWidgetActive && (
          <p className="text-xs text-muted-foreground">
            A floating ✨ button is visible on every page of your Shopify store. Customers can click it to get AI-powered outfit recommendations.
          </p>
        )}

        {/* Manual Install Fallback */}
        <Separator className="my-2" />
        <div className="space-y-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowManualInstall(!showManualInstall)}
          >
            <Code className="h-4 w-4 mr-2" />
            {showManualInstall ? 'Hide Manual Install' : 'Manual Install (Recommended)'}
          </Button>

          {showManualInstall && brandData?.id && (
            <div className="space-y-3 rounded-md border p-4 bg-muted/50">
              <p className="text-sm font-medium">Paste this script into your Shopify theme:</p>
              <div className="relative">
                <pre className="text-xs bg-background rounded p-3 overflow-x-auto border font-mono">
                  {`<script src="${import.meta.env.VITE_SUPABASE_URL}/functions/v1/widget-loader?brand_id=${brandData.id}" defer></script>`}
                </pre>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-1 right-1 h-7 w-7"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `<script src="${import.meta.env.VITE_SUPABASE_URL}/functions/v1/widget-loader?brand_id=${brandData.id}" defer></script>`
                    );
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                    toast({ title: 'Copied!', description: 'Script tag copied to clipboard.' });
                  }}
                >
                  {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>In Shopify Admin, go to <strong>Online Store → Themes → Edit code</strong></li>
                <li>Open <strong>theme.liquid</strong></li>
                <li>Paste the script just before the closing <code className="bg-background px-1 rounded">&lt;/body&gt;</code> tag</li>
                <li>Click <strong>Save</strong> — the widget will appear immediately</li>
              </ol>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
