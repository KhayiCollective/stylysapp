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
  const [webhooks, setWebhooks] = useState<WebhookInfo[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [brandId, setBrandId] = useState<string | null>(null);

  const expectedWebhooks = [
    'products/create',
    'products/update',
    'products/delete',
    'inventory_levels/update',
    'app/uninstalled',
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
            .select('shopify_store_domain, shopify_access_token')
            .eq('id', profile.brand_id)
            .single();

          setIsConnected(!!brand?.shopify_store_domain && !!brand?.shopify_access_token);
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
  const allRegistered = expectedWebhooks.every(t => registeredTopics.includes(t));

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
          <Badge variant={allRegistered ? 'default' : 'destructive'}>
            {allRegistered ? 'Active' : 'Incomplete'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          {expectedWebhooks.map(topic => {
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

        {!allRegistered && (
          <p className="text-xs text-muted-foreground text-center">
            Missing webhooks? Reconnect your Shopify store to register them automatically.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
