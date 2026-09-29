// Build-time prerender entry for public marketing/docs pages.
// Used only by scripts/prerender.mjs; the browser app still boots from main.tsx.
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { EmbeddedAppProvider } from "@/components/EmbeddedAppProvider";
import Index from "./pages/Index";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import GettingStarted from "./pages/docs/GettingStarted";
import ShopifySetup from "./pages/docs/ShopifySetup";
import WidgetEmbed from "./pages/docs/WidgetEmbed";
import FAQ from "./pages/docs/FAQ";

export function render(url: string): string {
  const queryClient = new QueryClient();
  return renderToString(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <EmbeddedAppProvider>
          <TooltipProvider>
            <StaticRouter location={url}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/docs" element={<GettingStarted />} />
                <Route path="/docs/getting-started" element={<GettingStarted />} />
                <Route path="/docs/shopify-setup" element={<ShopifySetup />} />
                <Route path="/docs/widget-embed" element={<WidgetEmbed />} />
                <Route path="/docs/faq" element={<FAQ />} />
              </Routes>
            </StaticRouter>
          </TooltipProvider>
        </EmbeddedAppProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
