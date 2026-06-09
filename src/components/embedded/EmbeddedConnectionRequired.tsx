import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Store, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import createApp from "@shopify/app-bridge";
import { Redirect } from "@shopify/app-bridge/actions";

interface EmbeddedConnectionRequiredProps {
  shopDomain: string | null;
  autoInitiate?: boolean;
}

const SHOPIFY_API_KEY = "e1bde8232afcab4c37b12a9b29c3dde1";

export function EmbeddedConnectionRequired({ shopDomain, autoInitiate }: EmbeddedConnectionRequiredProps) {
  const [searchParams] = useSearchParams();
  const [initiating, setInitiating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiateOAuth = async () => {
    if (!shopDomain) {
      setError("No shop domain available. Please open this app from Shopify Admin.");
      return;
    }

    setInitiating(true);
    setError(null);

    try {
      let shop = shopDomain;
      if (!shop.includes(".myshopify.com")) {
        shop = `${shop}.myshopify.com`;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-oauth?action=embedded-authorize&shop=${encodeURIComponent(shop)}`,
        { method: "GET" }
      );

      const result = await response.json();

      if (!result.authUrl) {
        setError(result.error || "Failed to start authorization");
        setInitiating(false);
        return;
      }

      // Perform the OAuth redirect at the TOP frame. Inside Shopify admin
      // we must use App Bridge's Redirect.REMOTE action so the parent admin
      // window performs the navigation (otherwise the iframe is blocked and
      // browsers fall back to opening a new tab).
      const host = searchParams.get("host");
      const embedded = window.self !== window.top;

      if (embedded && host) {
        try {
          const app = createApp({
            apiKey: SHOPIFY_API_KEY,
            host,
            forceRedirect: true,
          });
          Redirect.create(app).dispatch(Redirect.Action.REMOTE, result.authUrl);
          return;
        } catch (e) {
          console.warn("[EmbeddedConnectionRequired] App Bridge redirect failed, falling back", e);
        }
      }

      // Non-embedded fallback: navigate the top window in-place (no popup, no new tab).
      if (window.top) {
        window.top.location.href = result.authUrl;
      } else {
        window.location.href = result.authUrl;
      }
    } catch (err) {
      console.error("[EmbeddedConnectionRequired] OAuth initiation failed:", err);
      setError("Failed to connect. Please try again.");
      setInitiating(false);
    }
  };

  if (autoInitiate && shopDomain && !initiating && !error) {
    setTimeout(() => initiateOAuth(), 0);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-lg w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Store className="h-8 w-8 text-primary" />
        </div>

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

        {initiating && (
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">{error}</div>
        )}

        {shopDomain && !initiating && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-sm">
            <Store className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono">{shopDomain}</span>
          </div>
        )}

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
