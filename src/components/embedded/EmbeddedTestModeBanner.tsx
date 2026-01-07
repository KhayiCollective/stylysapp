import { FlaskConical, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface EmbeddedTestModeBannerProps {
  shopDomain: string | null;
  onExitTestMode?: () => void;
}

export function EmbeddedTestModeBanner({ shopDomain, onExitTestMode }: EmbeddedTestModeBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const connectUrl = shopDomain 
    ? `/connect-shopify?shop=${encodeURIComponent(shopDomain)}&embedded=true`
    : `/connect-shopify?embedded=true`;

  const handleConnect = () => {
    window.open(connectUrl, '_blank', 'noopener,noreferrer');
    onExitTestMode?.();
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 p-1.5 rounded-md bg-amber-100 dark:bg-amber-900/40">
            <FlaskConical className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-sm">
            <span className="font-medium text-amber-800 dark:text-amber-200">Test Mode</span>
            <span className="text-amber-700 dark:text-amber-300 ml-1.5">
              — Viewing with sample data. Some features are disabled.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleConnect}
            className="h-7 text-xs border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/40"
          >
            <ExternalLink className="h-3 w-3 mr-1.5" />
            Connect Real Store
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-600 dark:text-amber-400"
            aria-label="Dismiss banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
