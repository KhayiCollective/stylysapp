import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Store, CheckCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ShopifyConnectionProps {
  className?: string;
}

export function ShopifyConnection({ className }: ShopifyConnectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [shopifyData, setShopifyData] = useState<{
    storeDomain: string | null;
    connectedAt: string | null;
  } | null>(null);

  useEffect(() => {
    const fetchShopifyStatus = async () => {
      if (!user) return;

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

          setShopifyData({
            storeDomain: brand?.shopify_store_domain || null,
            connectedAt: brand?.shopify_connected_at || null,
          });
        }
      } catch (error) {
        console.error('Error fetching Shopify status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchShopifyStatus();
  }, [user]);

  const handleReconnect = () => {
    window.location.href = '/connect-shopify';
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Shopify Connection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-16 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const isConnected = !!shopifyData?.connectedAt;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="h-5 w-5" />
          Shopify Connection
        </CardTitle>
        <CardDescription>
          Manage your Shopify store integration
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div className="flex-1">
                <p className="font-medium text-green-800 dark:text-green-200">Connected</p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  {shopifyData?.storeDomain}
                </p>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Active
              </Badge>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`https://${shopifyData?.storeDomain}/admin`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Shopify Admin
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={handleReconnect}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reconnect
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Connected on {new Date(shopifyData?.connectedAt || '').toLocaleDateString()}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <Store className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <div className="flex-1">
                <p className="font-medium text-amber-800 dark:text-amber-200">Not Connected</p>
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Connect your Shopify store to get started
                </p>
              </div>
            </div>

            <Button onClick={handleReconnect}>
              <Store className="h-4 w-4 mr-2" />
              Connect Shopify Store
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
