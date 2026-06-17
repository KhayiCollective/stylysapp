import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useEmbeddedApp } from "@/components/EmbeddedAppProvider";
import { EmbeddedDashboard } from "@/components/layout/EmbeddedDashboard";
import { EmbeddedConnectionRequired } from "@/components/embedded/EmbeddedConnectionRequired";
import Dashboard from "./Dashboard";

console.log('[EmbeddedApp] v2 loaded');

export default function EmbeddedApp() {
  console.log('[EmbeddedApp] mount, URL:', window.location.href);
  const [searchParams] = useSearchParams();
  const { config } = useEmbeddedApp();

  const shop = searchParams.get("shop") || config?.shop;
  const host = searchParams.get("host");
  // Test mode is only allowed in non-production builds to prevent shop-verification bypass.
  const isTestMode = searchParams.get("test") === "true" && import.meta.env.DEV;

  console.log('[EmbeddedApp] shop param:', shop);
  console.log('[EmbeddedApp] host param:', host);
  console.log('[EmbeddedApp] searchParams:', Object.fromEntries(searchParams));

  // Write the embedded-session flag so ProtectedRoute's isRunningEmbedded() returns
  // true after client-side navigation drops the shop param from the URL.
  useEffect(() => {
    if (shop) {
      try { sessionStorage.setItem('stylys:embedded-session', '1'); } catch { /* ignore */ }
    }
  }, [shop]);

  // When shop param is absent (not launched from Shopify admin), prompt connection.
  // When present, trust the Shopify admin iframe context — the signed host param and
  // Shopify's own embed security are sufficient; data is protected by Supabase RLS.
  if (!isTestMode && !shop) {
    return <EmbeddedConnectionRequired shopDomain={null} autoInitiate={false} />;
  }

  return (
    <EmbeddedDashboard testMode={isTestMode} shopDomain={shop}>
      <Dashboard />
    </EmbeddedDashboard>
  );
}
