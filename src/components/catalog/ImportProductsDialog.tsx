import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Download, ShoppingBag, Store, ArrowLeft, CheckCircle2, AlertCircle, Loader2, FileSpreadsheet, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface ImportProductsDialogProps {
  brandId: string;
  shopifyConnected: boolean;
  onImportComplete: () => void;
}

type Step = "platform" | "shopify" | "woocommerce" | "csv" | "importing" | "result";

interface ImportResult {
  created: number;
  updated: number;
  total: number;
  errors?: string[];
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/['"]/g, ""));
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    
    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });
    rows.push(row);
  }
  return rows;
}

export function ImportProductsDialog({ brandId, shopifyConnected, onImportComplete }: ImportProductsDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("platform");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<Record<string, string>[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    setCsvFile(null);
    setCsvPreview(null);
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast({ title: "Invalid file", description: "Please upload a .csv file", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "CSV must be under 5MB", variant: "destructive" });
      return;
    }

    setCsvFile(file);
    const text = await file.text();
    const rows = parseCSV(text);
    setCsvPreview(rows);
  };

  const handleCSVImport = async () => {
    if (!csvPreview || csvPreview.length === 0) return;

    setStep("importing");
    setImporting(true);
    setError(null);

    let created = 0;
    const errors: string[] = [];

    try {
      const products = csvPreview.map((row) => ({
        brand_id: brandId,
        name: row.name || row.title || row.product_name || "Untitled",
        category: row.category || row.type || row.product_type || "uncategorized",
        price: parseFloat(row.price || row.amount || "0") || 0,
        image_url: row.image_url || row.image || row.img || null,
        color: row.color || null,
        fit: row.fit || null,
        tags: row.tags ? row.tags.split(";").map((t: string) => t.trim()).filter(Boolean) : [],
        inventory_status: row.inventory_status || row.status || "in_stock",
        source: "manual" as const,
      }));

      // Batch insert in chunks of 50
      const chunkSize = 50;
      for (let i = 0; i < products.length; i += chunkSize) {
        const chunk = products.slice(i, i + chunkSize);
        const { error: insertError, data } = await supabase
          .from("products")
          .insert(chunk)
          .select("id");

        if (insertError) {
          errors.push(`Batch ${Math.floor(i / chunkSize) + 1}: ${insertError.message}`);
        } else {
          created += data?.length || 0;
        }
      }

      setResult({ created, updated: 0, total: csvPreview.length, errors: errors.length > 0 ? errors : undefined });
      setStep("result");
      onImportComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSV import failed");
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
            {step === "csv" && "Import from CSV"}
            {step === "importing" && "Importing..."}
            {step === "result" && (error ? "Import Failed" : "Import Complete")}
          </DialogTitle>
        </DialogHeader>

        {/* Platform selection */}
        {step === "platform" && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            <Card
              className="cursor-pointer hover:border-foreground/30 transition-colors"
              onClick={() => setStep("shopify")}
            >
              <CardContent className="flex flex-col items-center justify-center p-5 text-center gap-2">
                <ShoppingBag className="w-8 h-8 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Shopify</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {shopifyConnected ? "Connected" : "Not connected"}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:border-foreground/30 transition-colors"
              onClick={() => setStep("woocommerce")}
            >
              <CardContent className="flex flex-col items-center justify-center p-5 text-center gap-2">
                <Store className="w-8 h-8 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">WooCommerce</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Connect store</p>
                </div>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer hover:border-foreground/30 transition-colors"
              onClick={() => setStep("csv")}
            >
              <CardContent className="flex flex-col items-center justify-center p-5 text-center gap-2">
                <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">CSV File</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Upload file</p>
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

        {/* CSV Upload step */}
        {step === "csv" && (
          <div className="mt-4 space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep("platform")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Upload a CSV file with your products. The file should include columns for at least <strong>name</strong> and <strong>price</strong>.
              </p>

              <div className="bg-muted rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Supported columns:</p>
                <p><code className="bg-background px-1 rounded">name</code> (required) — Product name</p>
                <p><code className="bg-background px-1 rounded">price</code> — Price as a number</p>
                <p><code className="bg-background px-1 rounded">category</code> — e.g. tops, bottoms, shoes</p>
                <p><code className="bg-background px-1 rounded">image_url</code> — URL to product image</p>
                <p><code className="bg-background px-1 rounded">color</code>, <code className="bg-background px-1 rounded">fit</code>, <code className="bg-background px-1 rounded">tags</code> (semicolon-separated)</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileSelect}
              />

              {!csvFile ? (
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-foreground/30 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Click to upload CSV</p>
                  <p className="text-xs text-muted-foreground mt-1">Max 5MB</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-muted rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium truncate max-w-[200px]">{csvFile.name}</span>
                    </div>
                    <Badge variant="outline">{csvPreview?.length || 0} rows</Badge>
                  </div>

                  {csvPreview && csvPreview.length > 0 && (
                    <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1 max-h-32 overflow-y-auto">
                      <p className="font-medium text-foreground mb-1">Preview (first 3 rows):</p>
                      {csvPreview.slice(0, 3).map((row, i) => (
                        <p key={i} className="text-muted-foreground truncate">
                          {row.name || row.title || "Untitled"} — {row.category || "no category"} — {row.price || "0"}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setCsvFile(null);
                        setCsvPreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      Remove
                    </Button>
                    <Button
                      variant="editorial"
                      size="sm"
                      className="flex-1"
                      onClick={handleCSVImport}
                      disabled={!csvPreview || csvPreview.length === 0}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Import {csvPreview?.length || 0} Products
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
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
