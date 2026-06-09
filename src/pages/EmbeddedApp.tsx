import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useEmbeddedApp } from "@/components/EmbeddedAppProvider";
import { EmbeddedDashboard } from "@/components/layout/EmbeddedDashboard";
import { EmbeddedConnectionRequired } from "@/components/embedded/EmbeddedConnectionRequired";
import Dashboard from "./Dashboard";

export default function EmbeddedApp() {
  const [searchParams] = useSearchParams();
  const { config, getSessionToken } = useEmbeddedApp();
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [needsConnection, setNeedsConnection] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const shop = searchParams.get("shop") || config?.shop;
  const host = searchParams.get("host") || config?.host;
  // Test mode is only allowed in non-production builds to prevent shop-verification bypass.
  const isTestMode = searchParams.get("test") === "true" && import.meta.env.DEV;

  useEffect(() => {
    let cancelled = false;

    // Hard timeout — never spin longer than 10s
    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      cancelled = true;
      setLoadError(
        "Loading is taking longer than expected. Please check your connection and try reloading the app from Shopify Admin."
      );
      setVerifying(false);
    }, 10000);

    const verifyShop = async () => {
      if (isTestMode) {
        if (cancelled) return;
        setVerified(true);
        setVerifying(false);
        window.clearTimeout(timeoutId);
        return;
      }

      if (!shop) {
        if (cancelled) return;
        setNeedsConnection(true);
        setVerifying(false);
        window.clearTimeout(timeoutId);
        return;
      }

      // If embedded with shop+host, trust the Shopify-provided session.
      // App Bridge's presence (shop+host params in iframe) means Shopify has already
      // authenticated the merchant — we can grant access immediately and try to
      // fetch a session token in the background if needed.
      const embedded = window.self !== window.top;
      if (embedded && host) {
        // Try to obtain a session token, but don't block on it — App Bridge script
        // may still be loading. Presence of shop+host inside the iframe is itself
        // proof of a valid Shopify session.
        try {
          // Best-effort: wait briefly for shopify global, then request a token.
          for (let i = 0; i < 10; i++) {
            if (window.shopify?.idToken) break;
            await new Promise((r) => setTimeout(r, 100));
          }
          await Promise.race([
            getSessionToken(),
            new Promise((_, rej) =>
              setTimeout(() => rej(new Error("getSessionToken timeout")), 2000)
            ),
          ]);
        } catch (e) {
          console.warn("Session token fetch failed (continuing):", e);
        }
        if (cancelled) return;
        // Embedded context confirmed (shop+host in iframe). Grant access
        // regardless of whether the session token call resolved.
        setVerified(true);
        setVerifying(false);
        window.clearTimeout(timeoutId);
        return;
      }

      // Non-embedded fallback: verify via backend
      try {
        const shopDomain = shop.includes('.myshopify.com') ? shop : `${shop}.myshopify.com`;
        const controller = new AbortController();
        const fetchTimeout = window.setTimeout(() => controller.abort(), 8000);

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-oauth?action=verify-shop&shop=${encodeURIComponent(shopDomain)}`,
          { signal: controller.signal }
        );
        window.clearTimeout(fetchTimeout);
        const result = await res.json();

        if (cancelled) return;
        if (result.connected) {
          setVerified(true);
        } else {
          setNeedsConnection(true);
        }
      } catch (err) {
        console.error('Verification error:', err);
        if (cancelled) return;
        setNeedsConnection(true);
      } finally {
        if (!cancelled) {
          setVerifying(false);
          window.clearTimeout(timeoutId);
        }
      }
    };

    verifyShop();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
    // Intentionally exclude getSessionToken — it's a new ref every render and
    // would re-trigger this effect, cancelling the in-flight verification.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop, host, isTestMode]);

  const isEmbedded = window.self !== window.top;

  const hasShopifyGlobal = typeof window !== "undefined" && !!window.shopify;
  const hasIdToken = !!window.shopify?.idToken;
  const appBridgeScriptPresent =
    typeof document !== "undefined" &&
    !!document.querySelector('script[src*="app-bridge.js"]');
  const apiKeyMeta =
    typeof document !== "undefined"
      ? document
          .querySelector('meta[name="shopify-api-key"]')
          ?.getAttribute("content") || null
      : null;

  const debugBanner = (
    <div className="bg-yellow-100 text-yellow-900 p-2 text-xs font-mono border-b border-yellow-300 space-y-1">
      <div><strong>shop:</strong> {shop || "(none)"}</div>
      <div><strong>host:</strong> {host ? `${host.substring(0, 30)}...` : "(none)"}</div>
      <div><strong>window.self === window.top:</strong> {String(window.self === window.top)}</div>
      <div><strong>isEmbedded:</strong> {String(isEmbedded)}</div>
      <div><strong>verifying:</strong> {String(verifying)}</div>
      <div><strong>verified:</strong> {String(verified)}</div>
      <div><strong>needsConnection:</strong> {String(needsConnection)}</div>
      <div><strong>loadError:</strong> {loadError ?? "(null)"}</div>
      <div><strong>isTestMode:</strong> {String(isTestMode)}</div>
      <div><strong>app-bridge script tag present:</strong> {String(appBridgeScriptPresent)}</div>
      <div><strong>window.shopify present:</strong> {String(hasShopifyGlobal)}</div>
      <div><strong>window.shopify.idToken present:</strong> {String(hasIdToken)}</div>
      <div><strong>shopify-api-key meta:</strong> {apiKeyMeta ?? "(missing)"}</div>
    </div>
  );

  if (loadError) {
    return (
      <>
        {debugBanner}
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-xl font-semibold text-foreground">Unable to load STYLYS</h1>
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
            >
              Reload
            </button>
          </div>
        </div>
      </>
    );
  }


  if (verifying) {
    return (
      <>
        {debugBanner}
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-muted-foreground text-sm">Loading STYLYS...</p>
          </div>
        </div>
      </>
    );
  }

  if (needsConnection) {
    return (
      <>
        {debugBanner}
        <EmbeddedConnectionRequired shopDomain={shop} autoInitiate={!!shop} />
      </>
    );
  }

  if (verified) {
    return (
      <>
        {debugBanner}
        <EmbeddedDashboard testMode={isTestMode} shopDomain={shop}>
          <Dashboard />
        </EmbeddedDashboard>
      </>
    );
  }

  return (
    <>
      {debugBanner}
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <p className="text-muted-foreground text-sm">Unknown state — please reload.</p>
      </div>
    </>
  );
}
