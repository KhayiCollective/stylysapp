import { useState, useEffect, useCallback } from "react";
import { Store, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmbeddedConnectionRequiredProps {
  shopDomain: string | null;
  autoInitiate?: boolean;
}

export function EmbeddedConnectionRequired({ shopDomain, autoInitiate }: EmbeddedConnectionRequiredProps) {
  const [initiating, setInitiating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiateOAuth = useCallback(async () => {
    if (!shopDomain) {
      setError("No shop domain available. Please open this app from Shopify Admin.");
      return;
    }

    setInitiating(true);
    setError(null);

    try {
      let shop = shopDomain;
      if (!shop.includes('.myshopify.com')) {
        shop = `${shop}.myshopify.com`;
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-oauth?action=embedded-authorize&shop=${encodeURIComponent(shop)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('[EmbeddedConnectionRequired] HTTP error:', response.status, text);
        setError(`Failed to start authorization (${response.status})`);
        setInitiating(false);
        return;
      }

      const result = await response.json();

      if (result.authUrl) {
        // Break out of Shopify Admin iframe. Fall back to current window if top is blocked.
        try {
          if (window.top) {
            window.top.location.href = result.authUrl;
          } else {
            window.location.href = result.authUrl;
          }
        } catch {
          window.location.href = result.authUrl;
        }
      } else {
        setError(result.error || "Failed to start authorization");
        setInitiating(false);
      }
    } catch (err) {
      console.error("[EmbeddedConnectionRequired] OAuth initiation failed:", err);
      setError("Failed to connect. Please try again.");
      setInitiating(false);
    }
  }, [shopDomain]);

  useEffect(() => {
    if (autoInitiate && shopDomain && !initiating && !error) {
      initiateOAuth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoInitiate, shopDomain]);



  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-lg w-full text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Store className="h-8 w-8 text-primary" />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl font-display font-bold text-foreground">
            {initiating ? "Connecting to Shopify..." : "Store Connection Required"}
          </h1>
          <p className="text-muted-foreground">
            {initiating
              ? "Redirecting you to Shopify to authorize STYLYS..."
              : "To use STYLYS, you need to authorize the app with your Shopify store."}
          </p>
        </div>

        {/* Loading spinner when initiating */}
        {initiating && (
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
            {error}
          </div>
        )}

        {/* Shop domain display */}
        {shopDomain && !initiating && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-sm">
            <Store className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono">{shopDomain}</span>
          </div>
        )}

        {/* CTA - only show when not auto-initiating */}
        {!initiating && (
          <div className="space-y-3">
            <Button onClick={initiateOAuth} size="lg" className="w-full gap-2" disabled={initiating}>
              Connect Store
              <ExternalLink className="h-4 w-4" />
            </Button>
            <p className="text-xs text-muted-foreground">
              You'll be redirected to Shopify to authorize STYLYS, then brought back here automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
