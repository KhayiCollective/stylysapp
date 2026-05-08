import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Webhook, CheckCircle, XCircle, RefreshCw, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WebhookInfo {
  topic: string;
  address: string;
  created_at: string;
}

export function WebhookStatusIndicator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [webhooks, setWebhooks] = useState<WebhookInfo[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [brandId, setBrandId] = useState<string | null>(null);

  const apiManagedWebhooks = [
    'products/create',
    'products/update',
    'products/delete',
    'inventory_levels/update',
    'app/uninstalled',
  ];

  const configManagedWebhooks = [
    'customers/data_request',
    'customers/redact',
    'shop/redact',
  ];

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('brand_id')
          .eq('id', user.id)
          .single();

        if (profile?.brand_id) {
          setBrandId(profile.brand_id);
          
          const { data: brand } = await supabase
            .from('brands')
            .select('shopify_store_domain, shopify_connected_at')
            .eq('id', profile.brand_id)
            .single();

          setIsConnected(!!brand?.shopify_store_domain && !!brand?.shopify_connected_at);
        }
      } catch (error) {
        console.error('Error fetching webhook status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const fetchWebhooks = async () => {
    if (!brandId) return;
    setRefreshing(true);

    try {
      const { data, error } = await supabase.functions.invoke('shopify-product-sync', {
        body: { brand_id: brandId, action: 'webhooks' },
      });

      if (error) throw error;
      setWebhooks(data?.webhooks || []);
    } catch (error) {
      console.error('Error fetching webhooks:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const registerMissingWebhooks = async () => {
    if (!brandId) return;
    setRegistering(true);

    try {
      const { data, error } = await supabase.functions.invoke('shopify-product-sync', {
        body: { brand_id: brandId, action: 'register-webhooks' },
      });

      if (error) throw error;

      const registered = data?.registered || [];
      const failed = data?.failed || [];

      if (failed.length > 0) {
        toast({
          title: 'Some webhooks failed',
          description: `Registered ${registered.length}, failed ${failed.length}: ${failed.join(', ')}`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Webhooks registered',
          description: `Successfully registered ${registered.length} missing webhook(s).`,
        });
      }

      // Refresh status
      await fetchWebhooks();
    } catch (error) {
      console.error('Error registering webhooks:', error);
      toast({
        title: 'Registration failed',
        description: 'Could not register webhooks. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setRegistering(false);
    }
  };

  useEffect(() => {
    if (brandId && isConnected) {
      fetchWebhooks();
    }
  }, [brandId, isConnected]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhook Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-24 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!isConnected) {
    return null;
  }

  const registeredTopics = webhooks.map(w => w.topic);
  const allApiRegistered = apiManagedWebhooks.every(t => registeredTopics.includes(t));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Webhook Status
            </CardTitle>
            <CardDescription>
              Real-time sync webhooks for automatic product updates
            </CardDescription>
          </div>
          <Badge variant={allApiRegistered ? 'default' : 'destructive'}>
            {allApiRegistered ? 'Active' : 'Incomplete'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">API-managed</p>
          {apiManagedWebhooks.map(topic => {
            const isActive = registeredTopics.includes(topic);
            return (
              <div key={topic} className="flex items-center justify-between p-2 rounded bg-muted/50">
                <div className="flex items-center gap-2">
                  {isActive ? (
                    <CheckCircle className="h-4 w-4 text-success" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="text-sm font-mono">{topic}</span>
                </div>
                <Badge variant={isActive ? 'outline' : 'secondary'} className="text-xs">
                  {isActive ? 'Registered' : 'Missing'}
                </Badge>
              </div>
            );
          })}

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-3">Compliance (app-config managed)</p>
          {configManagedWebhooks.map(topic => (
            <div key={topic} className="flex items-center justify-between p-2 rounded bg-muted/50">
              <div className="flex items-center gap-2">
                <Webhook className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-mono">{topic}</span>
              </div>
              <Badge variant="outline" className="text-xs">Config</Badge>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Compliance webhooks are declared in <code className="text-xs">shopify.app.toml</code> and registered via <code className="text-xs">shopify app deploy</code>.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchWebhooks}
          disabled={refreshing}
          className="w-full"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh Status
        </Button>

        {!allApiRegistered && (
          <div className="space-y-2">
            <Button
              variant="default"
              size="sm"
              onClick={registerMissingWebhooks}
              disabled={registering}
              className="w-full"
            >
              {registering ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Webhook className="h-4 w-4 mr-2" />
              )}
              Register Missing Webhooks
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Uses your existing access token — no reconnect needed.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
