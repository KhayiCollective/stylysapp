import { Store, ExternalLink, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmbeddedConnectionRequiredProps {
  shopDomain: string | null;
}

export function EmbeddedConnectionRequired({ shopDomain }: EmbeddedConnectionRequiredProps) {
  const connectUrl = shopDomain 
    ? `/connect-shopify?shop=${encodeURIComponent(shopDomain)}&embedded=true`
    : `/connect-shopify?embedded=true`;

  const handleConnect = () => {
    // Open in new window to avoid iframe restrictions
    window.open(connectUrl, '_blank', 'noopener,noreferrer');
  };

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
            Store Connection Required
          </h1>
          <p className="text-muted-foreground">
            To use STYLYS in your Shopify admin, you need to complete the OAuth connection first.
          </p>
        </div>

        {/* Shop domain display */}
        {shopDomain && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-sm">
            <Store className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono">{shopDomain}</span>
          </div>
        )}

        {/* Steps */}
        <div className="bg-card border border-border rounded-xl p-6 text-left space-y-4">
          <h2 className="font-medium text-sm text-foreground">Setup Steps:</h2>
          <ol className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center">
                1
              </span>
              <div>
                <p className="font-medium text-sm">Sign in to STYLYS</p>
                <p className="text-xs text-muted-foreground">
                  Create an account or sign in with your existing credentials
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center">
                2
              </span>
              <div>
                <p className="font-medium text-sm">Connect your Shopify store</p>
                <p className="text-xs text-muted-foreground">
                  Authorize STYLYS to access your product catalog
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center">
                3
              </span>
              <div>
                <p className="font-medium text-sm">Return to Shopify Admin</p>
                <p className="text-xs text-muted-foreground">
                  The embedded app will activate automatically
                </p>
              </div>
            </li>
          </ol>
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <Button onClick={handleConnect} size="lg" className="w-full gap-2">
            Connect Store
            <ExternalLink className="h-4 w-4" />
          </Button>
          <p className="text-xs text-muted-foreground">
            Opens in a new window. Return here after connecting.
          </p>
        </div>

        {/* Test mode link */}
        <div className="pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Want to preview first?{" "}
            <a 
              href={`/embedded?test=true${shopDomain ? `&shop=${shopDomain}` : ''}`}
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Try test mode
              <ArrowRight className="h-3 w-3" />
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
