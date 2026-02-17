import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, Loader2, Power, PowerOff } from 'lucide-react';

export function WidgetStatus() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
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

  const handleToggle = async () => {
    if (!brandData?.id) return;
    setToggling(true);

    try {
      const { data, error } = await supabase.functions.invoke('shopify-widget-toggle', {
        body: { brand_id: brandData.id, action: isWidgetActive ? 'remove' : 'install' },
      });

      if (error) throw error;

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
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to toggle widget. Please try again.',
        variant: 'destructive',
      });
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
      </CardContent>
    </Card>
  );
}
