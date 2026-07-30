import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, Loader2, ExternalLink } from 'lucide-react';

export function WidgetStatus() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [embedEnabled, setEmbedEnabled] = useState<boolean | null>(null);
  const [brandData, setBrandData] = useState<{
    id: string;
    shopify_store_domain: string | null;
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
          .select('id, shopify_store_domain')
          .eq('id', profile.brand_id)
          .single();

        setBrandData(brand as any);
      }
      setLoading(false);
    };
    fetchBrand();
  }, [user]);

  useEffect(() => {
    if (!brandData?.id) return;
    const checkEmbedStatus = async () => {
      const { data, error } = await supabase.functions.invoke('shopify-embed-status', {
        body: { brand_id: brandData.id },
      });
      if (!error && typeof data?.enabled === 'boolean') {
        setEmbedEnabled(data.enabled);
      }
    };
    checkEmbedStatus();
  }, [brandData?.id]);

  const isConnected = !!brandData?.shopify_store_domain;

  if (loading) return null;
  if (!isConnected) return null;

  const themeEditorUrl = `https://${brandData!.shopify_store_domain}/admin/themes/current/editor?context=apps&activateAppId=e1bde8232afcab4c37b12a9b29c3dde1/stylys-widget`;

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
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Status:</span>
          {embedEnabled === null ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : embedEnabled ? (
            <Badge variant="default" className="bg-primary">Active</Badge>
          ) : (
            <Badge variant="secondary">Not yet enabled</Badge>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          The widget is managed through your Shopify theme editor. Use the button below to open the App Embeds panel and toggle it on.
        </p>

        <Button asChild className="w-full">
          <a href={themeEditorUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Theme Editor
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
