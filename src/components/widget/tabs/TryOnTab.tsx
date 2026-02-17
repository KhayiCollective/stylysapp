import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, Camera, Loader2, X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function TryOnTab() {
  const [userImage, setUserImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For demo — in production, selected from outfits
  const [productImage] = useState("https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600");
  const [productName] = useState("Silk Midi Dress");

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Image must be under 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setUserImage(event.target?.result as string);
        setResultImage(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateTryOn = async () => {
    if (!userImage) return;
    setIsProcessing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("virtual-tryon", {
        body: {
          userImageBase64: userImage,
          productImageUrl: productImage,
          productCategory: "clothing",
        },
      });

      if (fnError) throw fnError;

      if (data?.success && data?.resultImage) {
        setResultImage(data.resultImage);
      } else {
        setError(data?.message || "Could not generate try-on. Try a different photo.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to process. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-base">Virtual Try-On</h3>
        <p className="text-xs text-muted-foreground">See how items look on you with AI</p>
      </div>

      {/* Product preview */}
      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
        <img src={productImage} alt={productName} className="w-12 h-12 rounded-md object-cover" />
        <div>
          <p className="text-sm font-medium">{productName}</p>
          <Badge variant="secondary" className="text-[10px]">Selected Item</Badge>
        </div>
      </div>

      {/* Upload */}
      {!userImage ? (
        <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors">
          <Upload className="h-6 w-6 text-muted-foreground mb-2" />
          <span className="text-sm text-muted-foreground">Upload your photo</span>
          <span className="text-[11px] text-muted-foreground mt-1">JPG or PNG, max 5MB</span>
          <Input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        </label>
      ) : (
        <div className="relative">
          <img src={userImage} alt="Your photo" className="w-full aspect-[3/4] object-cover rounded-lg" />
          <button
            onClick={() => { setUserImage(null); setResultImage(null); }}
            className="absolute top-2 right-2 h-6 w-6 bg-background/80 rounded-full flex items-center justify-center"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <Button
        className="w-full gap-2"
        size="sm"
        onClick={generateTryOn}
        disabled={!userImage || isProcessing}
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Camera className="h-4 w-4" />
            Try It On
          </>
        )}
      </Button>

      {resultImage && (
        <div className="relative rounded-lg overflow-hidden border border-border">
          <img src={resultImage} alt="Try-on result" className="w-full aspect-[3/4] object-cover" />
          <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px]">
            <Sparkles className="h-3 w-3 mr-1" />
            AI Generated
          </Badge>
        </div>
      )}
    </div>
  );
}
