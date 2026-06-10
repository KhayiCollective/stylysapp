import { useState } from "react";
import { Bell, Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getCustomerToken } from "@/lib/widgetAuth";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface NotifyMeButtonProps {
  brandId?: string;
  productId?: string;
  shopifyVariantId?: string | null;
  productName?: string;
  defaultEmail?: string;
}

function resolveShop(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const fromUrl = new URLSearchParams(window.location.search).get("shop") || undefined;
  const fromGlobal = (window as unknown as { Shopify?: { shop?: string } }).Shopify?.shop;
  return fromUrl || fromGlobal;
}

export function NotifyMeButton({ brandId, productId, shopifyVariantId, productName, defaultEmail }: NotifyMeButtonProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail || "");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email.trim()) { setError("Email required"); return; }
    setSubmitting(true);
    setError("");
    try {
      const token = getCustomerToken();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/widget-notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          brand_id: brandId,
          shop: resolveShop(),
          product_id: productId,
          shopify_variant_id: shopifyVariantId,
          product_name: productName,
          email: email.trim(),
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) { setError(data?.error || "Failed"); return; }
      setDone(true);
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
        <Check className="h-3 w-3" /> We'll email you
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
      >
        <Bell className="h-3 w-3" /> Notify me
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1 w-full">
      <div className="flex gap-1">
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          className="h-7 text-[11px] px-2"
        />
        <Button type="submit" size="sm" className="h-7 px-2 text-[10px]" disabled={submitting}>
          {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
        </Button>
      </div>
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </form>
  );
}
