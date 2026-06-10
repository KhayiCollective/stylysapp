import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { InlineCustomerWidget } from "@/components/widget/InlineCustomerWidget";
import { CustomerWidget } from "@/components/widget/CustomerWidget";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const WidgetPreview = () => {
  const [searchParams] = useSearchParams();
  const queryBrandId = searchParams.get("brand_id") || undefined;
  const shop = searchParams.get("shop") || undefined;
  // When a shop domain is present, ALWAYS resolve brand_id fresh from the
  // backend so we never use a cached/stale brand_id. Only fall back to the
  // query brand_id when there is no shop (e.g. merchant dashboard preview).
  const [brandId, setBrandId] = useState<string | undefined>(shop ? undefined : queryBrandId);
  const [resolving, setResolving] = useState(!!shop);
  const [isIframe, setIsIframe] = useState(false);

  useEffect(() => {
    try {
      setIsIframe(window.self !== window.top);
    } catch {
      setIsIframe(true);
    }
  }, []);

  // Auto-resolve brand from shop domain on every load (no caching).
  useEffect(() => {
    if (!shop) return;
    setResolving(true);
    const shopDomain = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;
    fetch(
      `${SUPABASE_URL}/functions/v1/shopify-oauth?action=verify-shop&shop=${encodeURIComponent(shopDomain)}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data?.brandId) setBrandId(data.brandId);
      })
      .catch(() => {})
      .finally(() => setResolving(false));
  }, [shop]);

  if (resolving) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // When loaded in an iframe (Shopify store), render the widget directly
  if (isIframe) {
    return <InlineCustomerWidget brandId={brandId} />;
  }

  // Standalone merchant preview mode
  return (
    <div className="min-h-screen bg-[#f8f6f3]">
      <header className="border-b border-border/50 bg-white">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <Link to="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <span className="font-semibold tracking-wider text-sm">DEMO STORE</span>
          <span className="text-xs text-muted-foreground">Widget Preview</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-2 gap-12">
          <div className="aspect-[3/4] rounded-xl overflow-hidden bg-muted">
            <img
              src="https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800"
              alt="Product"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="space-y-4 py-8">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Dresses</p>
            <h1 className="text-3xl font-semibold">Silk Midi Dress</h1>
            <p className="text-2xl">$189.00</p>
            <p className="text-muted-foreground leading-relaxed">
              A timeless silk midi dress with a flattering silhouette. Perfect for both
              office and evening occasions.
            </p>
            <p className="text-sm text-muted-foreground pt-4 border-t border-border mt-8">
              👉 Look for the <strong>"Style Me"</strong> tab on the right edge (desktop) or the ✨ button (mobile) to open the STYLYS widget.
            </p>
          </div>
        </div>
      </main>

      <CustomerWidget brandId={brandId} />
    </div>
  );
};

export default WidgetPreview;
