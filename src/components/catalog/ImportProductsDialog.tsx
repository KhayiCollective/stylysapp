import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Download, ShoppingBag, Store, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface ImportProductsDialogProps {
  brandId: string;
  shopifyConnected: boolean;
  onImportComplete: () => void;
}

type Step = "platform" | "shopify" | "woocommerce" | "importing" | "result";

interface ImportResult {
  created: number;
  updated: number;
  total: number;
  errors?: string[];
}

export function ImportProductsDialog({ brandId, shopifyConnected, onImportComplete }: ImportProductsDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("platform");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [wooForm, setWooForm] = useState({
    store_url: "",
    consumer_key: "",
    consumer_secret: "",
  });

  const reset = () => {
    setStep("platform");
    setResult(null);
    setError(null);
    setImporting(false);
    setWooForm({ store_url: "", consumer_key: "", consumer_secret: "" });
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) reset();
  };

  const handleShopifyImport = async () => {
    setStep("importing");
    setImporting(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("shopify-product-sync", {
        body: { brand_id: brandId, action: "sync" },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      setResult({ created: data.created, updated: data.updated, total: data.total, errors: data.errors });
      setStep("result");
      onImportComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStep("result");
    } finally {
      setImporting(false);
    }
  };

  const handleWooCommerceImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep("importing");
    setImporting(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("woocommerce-product-sync", {
        body: {
          brand_id: brandId,
          store_url: wooForm.store_url,
          consumer_key: wooForm.consumer_key,
          consumer_secret: wooForm.consumer_secret,
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      setResult({ created: data.created, updated: data.updated, total: data.total, errors: data.errors });
      setStep("result");
      onImportComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStep("result");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Import Products
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {step === "platform" && "Import Products"}
            {step === "shopify" && "Import from Shopify"}
            {step === "woocommerce" && "Import from WooCommerce"}
            {step === "importing" && "Importing..."}
            {step === "result" && (error ? "Import Failed" : "Import Complete")}
          </DialogTitle>
        </DialogHeader>

        {/* Platform selection */}
        {step === "platform" && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Card
              className="cursor-pointer hover:border-foreground/30 transition-colors"
              onClick={() => setStep("shopify")}
            >
              <CardContent className="flex flex-col items-center justify-center p-6 text-center gap-3">
                <ShoppingBag className="w-10 h-10 text-muted-foreground" />
                <div>
                  <p className="font-medium">Shopify</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {shopifyConnected ? "Connected" : "Not connected"}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:border-foreground/30 transition-colors"
              onClick={() => setStep("woocommerce")}
            >
              <CardContent className="flex flex-col items-center justify-center p-6 text-center gap-3">
                <Store className="w-10 h-10 text-muted-foreground" />
                <div>
                  <p className="font-medium">WooCommerce</p>
                  <p className="text-xs text-muted-foreground mt-1">Connect your store</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Shopify step */}
        {step === "shopify" && (
          <div className="mt-4 space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep("platform")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            {shopifyConnected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">Connected</Badge>
                  <span className="text-sm text-muted-foreground">Your Shopify store is linked</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  This will fetch all products from your Shopify store and import them into your catalog.
                  Existing products will be updated.
                </p>
                <Button variant="editorial" className="w-full" onClick={handleShopifyImport}>
                  <Download className="w-4 h-4 mr-2" />
                  Import from Shopify
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  You need to connect your Shopify store first before importing products.
                </p>
                <Button variant="editorial" className="w-full" onClick={() => {
                  setOpen(false);
                  navigate("/shopify-connect");
                }}>
                  Connect Shopify
                </Button>
              </div>
            )}
          </div>
        )}

        {/* WooCommerce step */}
        {step === "woocommerce" && (
          <form onSubmit={handleWooCommerceImport} className="mt-4 space-y-4">
            <Button type="button" variant="ghost" size="sm" onClick={() => setStep("platform")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <p className="text-sm text-muted-foreground">
              Enter your WooCommerce REST API credentials. You can generate them in
              WooCommerce → Settings → Advanced → REST API.
            </p>
            <div className="space-y-2">
              <Label htmlFor="woo_url">Store URL</Label>
              <Input
                id="woo_url"
                value={wooForm.store_url}
                onChange={(e) => setWooForm({ ...wooForm, store_url: e.target.value })}
                placeholder="https://your-store.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="woo_key">Consumer Key</Label>
              <Input
                id="woo_key"
                value={wooForm.consumer_key}
                onChange={(e) => setWooForm({ ...wooForm, consumer_key: e.target.value })}
                placeholder="ck_..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="woo_secret">Consumer Secret</Label>
              <Input
                id="woo_secret"
                type="password"
                value={wooForm.consumer_secret}
                onChange={(e) => setWooForm({ ...wooForm, consumer_secret: e.target.value })}
                placeholder="cs_..."
                required
              />
            </div>
            <Button type="submit" variant="editorial" className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Connect & Import
            </Button>
          </form>
        )}

        {/* Importing */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Fetching and importing products...</p>
            <Progress value={undefined} className="w-full" />
          </div>
        )}

        {/* Result */}
        {step === "result" && (
          <div className="mt-4 space-y-4">
            {error ? (
              <div className="flex flex-col items-center text-center gap-3 py-4">
                <AlertCircle className="w-10 h-10 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            ) : result && (
              <div className="flex flex-col items-center text-center gap-3 py-4">
                <CheckCircle2 className="w-10 h-10 text-success" />
                <div>
                  <p className="font-medium">Successfully imported {result.total} products</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {result.created} created, {result.updated} updated
                  </p>
                </div>
                {result.errors && result.errors.length > 0 && (
                  <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md w-full text-left">
                    <p className="font-medium mb-1">{result.errors.length} warnings:</p>
                    {result.errors.slice(0, 3).map((e, i) => (
                      <p key={i}>• {e}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
