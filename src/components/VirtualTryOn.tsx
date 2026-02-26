import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, Camera, Loader2, Sparkles, X, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface VirtualTryOnProps {
  productImage?: string;
  productName?: string;
}

export function VirtualTryOn({ productImage, productName }: VirtualTryOnProps) {
  const [userImage, setUserImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showingOriginal, setShowingOriginal] = useState(false);
  const { toast } = useToast();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUserImage(event.target?.result as string);
        setResultImage(null);
        setShowingOriginal(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateTryOn = async () => {
    if (!userImage) {
      toast({ title: "Upload a photo", description: "Please upload your photo first.", variant: "destructive" });
      return;
    }
    if (!productImage) {
      toast({ title: "Select a product", description: "Please select a product to try on.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke("virtual-tryon", {
        body: { userImageBase64: userImage, productImageUrl: productImage, productCategory: "clothing" },
      });

      if (error) throw error;

      if (data?.success && data?.resultImage) {
        setResultImage(data.resultImage);
        setShowingOriginal(false);
        toast({ title: "Try-on complete!", description: data.message || "See how the item looks on you." });
      } else {
        toast({ title: "Could not generate try-on", description: data?.message || data?.tip || "Please try with a different photo.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Virtual try-on error:", error);
      toast({ title: "Try-on failed", description: error?.message || "Failed to process virtual try-on", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const clearImages = () => {
    setUserImage(null);
    setResultImage(null);
    setShowingOriginal(false);
  };

  const displayImage = resultImage && !showingOriginal ? resultImage : userImage;
  const hasResult = !!resultImage;

  return (
    <Card className="card-editorial">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-xl flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Virtual Try-On
          </CardTitle>
          <Badge variant="secondary" className="text-xs">AI Powered</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload / Result Section — single container */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Your Photo</Label>
          {!userImage ? (
            <label className="flex flex-col items-center justify-center aspect-[3/4] border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-foreground/30 hover:bg-muted/30 transition-colors">
              <Upload className="w-8 h-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Upload your photo</span>
              <span className="text-xs text-muted-foreground mt-1">JPG or PNG, max 5MB</span>
              <Input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          ) : (
            <div className="relative">
              <img
                src={displayImage!}
                alt={hasResult && !showingOriginal ? "Try-on result" : "Your photo"}
                className="w-full aspect-[3/4] object-cover rounded-xl"
              />
              {/* AI Generated badge */}
              {hasResult && !showingOriginal && (
                <Badge className="absolute top-3 left-3 bg-foreground text-background">
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI Generated
                </Badge>
              )}
              {/* Toggle original/result */}
              {hasResult && (
                <button
                  onClick={() => setShowingOriginal(!showingOriginal)}
                  className="absolute bottom-3 left-3 h-8 px-3 bg-background/80 backdrop-blur-sm rounded-full flex items-center gap-1.5 text-xs font-medium text-foreground border border-border/50 hover:bg-background/95 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {showingOriginal ? "View Result" : "View Original"}
                </button>
              )}
              <Button
                size="icon-sm"
                variant="secondary"
                className="absolute top-2 right-2"
                onClick={clearImages}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Product Preview */}
        {productImage && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Selected Item</Label>
            <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-xl">
              <img src={productImage} alt={productName || "Product"} className="w-16 h-16 object-cover rounded-lg" />
              <div>
                <p className="font-medium text-sm">{productName || "Selected Product"}</p>
                <p className="text-xs text-muted-foreground">Ready for virtual try-on</p>
              </div>
            </div>
          </div>
        )}

        {/* Generate Button */}
        <Button
          variant="editorial"
          className="w-full"
          onClick={generateTryOn}
          disabled={!userImage || !productImage || isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Camera className="w-4 h-4 mr-2" />
              {hasResult ? "Try Again" : "Try It On"}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
