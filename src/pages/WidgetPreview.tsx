import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { InlineCustomerWidget } from "@/components/widget/InlineCustomerWidget";
import { CustomerWidget } from "@/components/widget/CustomerWidget";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const WidgetPreview = () => {
  const [searchParams] = useSearchParams();
  const queryBrandId = searchParams.get("brand_id") || undefined;
  const shop = searchParams.get("shop") || undefined;
  const [brandId, setBrandId] = useState<string | undefined>(undefined);
  const [resolving, setResolving] = useState(!!(queryBrandId || shop));
  const [isIframe, setIsIframe] = useState(false);

  useEffect(() => {
    try {
      setIsIframe(window.self !== window.top);
    } catch {
      setIsIframe(true);
    }
  }, []);

  useEffect(() => {
    console.log("[WidgetPreview] effect fired, shop:", shop, "queryBrandId:", queryBrandId);
    if (!queryBrandId && !shop) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const resolve = async () => {
      try {
        // Step 1: If queryBrandId is present, validate it exists in the current project.
        if (queryBrandId) {
          const resp = await fetch(
            `${SUPABASE_URL}/rest/v1/brands?id=eq.${queryBrandId}&select=id`,
            {
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              },
              signal: controller.signal,
            }
          );
          if (resp.ok) {
            const data = await resp.json();
            if (Array.isArray(data) && data.length > 0) {
              console.log("[WidgetPreview] queryBrandId validated:", queryBrandId);
              setBrandId(queryBrandId);
              return;
            }
          }
          console.log("[WidgetPreview] queryBrandId not found in current project, falling back to verify-shop");
        }

        // Step 2: Fall back to verify-shop using the shop param.
        if (!shop) {
          // No shop to resolve from — use queryBrandId as last resort.
          if (queryBrandId) setBrandId(queryBrandId);
          return;
        }
        const shopDomain = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;
        console.log("[WidgetPreview] about to fetch verify-shop");
        const resp = await fetch(
          `${SUPABASE_URL}/functions/v1/shopify-oauth?action=verify-shop&shop=${encodeURIComponent(shopDomain)}`,
          { signal: controller.signal }
        );
        console.log("[WidgetPreview] verify-shop status:", resp.status);
        const data = await resp.json();
        console.log("[WidgetPreview] verify-shop data:", data);
        if (data?.brandId) setBrandId(data.brandId);
      } catch (err) {
        console.log("[WidgetPreview] resolve error:", err);
        // On timeout/error, fall back to queryBrandId if available.
        if (queryBrandId) setBrandId(queryBrandId);
      } finally {
        console.log("[WidgetPreview] finally, clearing resolving");
        clearTimeout(timeoutId);
        setResolving(false);
      }
    };

    resolve();
  }, [shop, queryBrandId]);

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
