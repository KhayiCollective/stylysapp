import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, Package, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SyncStatus {
  totalProducts: number;
  syncedProducts: number;
  lastSyncAt: string | null;
  storeDomain: string | null;
}

export function ShopifySyncStatus() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!brandId || !isConnected) return;

    try {
      const { data, error } = await supabase.functions.invoke('shopify-product-sync', {
        body: { brand_id: brandId, action: 'status' },
      });

      if (error) throw error;
      setStatus(data);
    } catch (error) {
      console.error('Error fetching sync status:', error);
    }
  }, [brandId, isConnected]);

  useEffect(() => {
    const fetchBrandId = async () => {
      if (!user) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('brand_id')
          .eq('id', user.id)
          .single();

        if (profile?.brand_id) {
          setBrandId(profile.brand_id);

          // Check if Shopify is connected before calling the edge function
          const { data: brand } = await supabase
            .from('brands')
            .select('shopify_store_domain, shopify_access_token')
            .eq('id', profile.brand_id)
            .single();

          setIsConnected(!!brand?.shopify_store_domain && !!brand?.shopify_access_token);
        }
      } catch (error) {
        console.error('Error fetching brand:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBrandId();
  }, [user]);

  useEffect(() => {
    if (brandId && isConnected) {
      fetchStatus();
    }
  }, [brandId, isConnected, fetchStatus]);

  const handleSync = async () => {
    if (!brandId) return;

    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('shopify-product-sync', {
        body: { brand_id: brandId, action: 'sync' },
      });

      if (error) throw error;

      toast({
        title: 'Sync Complete',
        description: `Created ${data.created} products, updated ${data.updated}`,
      });

      // Refresh status
      await fetchStatus();
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: 'Sync Failed',
        description: error instanceof Error ? error.message : 'Failed to sync products',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Product Sync
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-24 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Product Sync
          </CardTitle>
          <CardDescription>
            Sync your Shopify products to the catalog
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Connect your Shopify store first to sync products
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const syncProgress = status?.totalProducts 
    ? Math.round((status.syncedProducts / status.totalProducts) * 100) 
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Product Sync
        </CardTitle>
        <CardDescription>
          Sync products from {status?.storeDomain}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sync Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground">Total Products</p>
            <p className="text-2xl font-semibold">{status?.totalProducts || 0}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground">Synced from Shopify</p>
            <p className="text-2xl font-semibold">{status?.syncedProducts || 0}</p>
          </div>
        </div>

        {/* Progress */}
        {status && status.totalProducts > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sync Coverage</span>
              <span className="font-medium">{syncProgress}%</span>
            </div>
            <Progress value={syncProgress} className="h-2" />
          </div>
        )}

        {/* Last Sync */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {status?.lastSyncAt ? (
            <span>Last synced: {new Date(status.lastSyncAt).toLocaleString()}</span>
          ) : (
            <span>Never synced</span>
          )}
        </div>

        {/* Sync Button */}
        <Button 
          onClick={handleSync} 
          disabled={syncing}
          className="w-full"
        >
          {syncing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Syncing Products...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync Products Now
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Products are also synced automatically via webhooks when changes occur in Shopify
        </p>
      </CardContent>
    </Card>
  );
}
