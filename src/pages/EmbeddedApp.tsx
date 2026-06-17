import { useSearchParams, useLocation } from "react-router-dom";
import { useEmbeddedApp } from "@/components/EmbeddedAppProvider";
import { EmbeddedDashboard } from "@/components/layout/EmbeddedDashboard";
import { EmbeddedConnectionRequired } from "@/components/embedded/EmbeddedConnectionRequired";
import Dashboard from "./Dashboard";
import Catalog from "./Catalog";
import Rules from "./Rules";
import Settings from "./Settings";

console.log('[EmbeddedApp] module loaded, href:', window.location.href);

export default function EmbeddedApp() {
  const [searchParams] = useSearchParams();
  const { config } = useEmbeddedApp();
  const location = useLocation();

  console.log('[EmbeddedApp] render — pathname:', location.pathname, 'search:', location.search, 'config.shop:', config?.shop);

  const shop = searchParams.get("shop") || config?.shop;
  const isTestMode = searchParams.get("test") === "true" && import.meta.env.DEV;

  // Write synchronously during render (not in a useEffect) so the flag is present
  // in sessionStorage before any ProtectedRoute renders on subsequent navigation.
  if (shop) {
    try { sessionStorage.setItem('stylys:embedded-session', '1'); } catch { /* ignore */ }
  }

  if (!isTestMode && !shop) {
    return <EmbeddedConnectionRequired shopDomain={null} autoInitiate={false} />;
  }

  // Sub-route within /embedded/* so all navigation stays inside the iframe.
  // EmbeddedDashboard's nav uses useNavigate (not anchor tags) to avoid Shopify
  // App Bridge intercepting clicks and triggering a top-frame page reload.
  const subPath = location.pathname.replace(/^\/embedded\/?/, "");
  const renderPage = () => {
    switch (subPath) {
      case "catalog": return <Catalog />;
      case "rules": return <Rules />;
      case "settings": return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <EmbeddedDashboard testMode={isTestMode} shopDomain={shop}>
      {renderPage()}
    </EmbeddedDashboard>
  );
}
