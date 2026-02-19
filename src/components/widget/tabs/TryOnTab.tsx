import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, Camera, Loader2, X, Sparkles, Eye, Save, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface OutfitItemProp {
  name: string;
  imageUrl: string;
  category: string;
}

interface TryOnTabProps {
  outfitItems?: OutfitItemProp[];
  customerPhotoUrl?: string;
  brandId?: string;
  customerToken?: string;
  onPhotoSaved?: (url: string) => void;
  bodyShape?: string;
  sizeInfo?: Record<string, string>;
}

export function TryOnTab({ outfitItems, customerPhotoUrl, brandId, customerToken, onPhotoSaved, bodyShape, sizeInfo }: TryOnTabProps) {
  const [userImage, setUserImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showingOriginal, setShowingOriginal] = useState(false);
  const [isSavedPhoto, setIsSavedPhoto] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);

  // Auto-load saved photo
  useEffect(() => {
    if (customerPhotoUrl && !userImage) {
      setUserImage(customerPhotoUrl);
      setIsSavedPhoto(true);
    }
  }, [customerPhotoUrl]);

  const savePhotoToAccount = async (base64: string) => {
    if (!customerToken || !brandId) return;
    setSavingPhoto(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/widget-customer-auth/photo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify({ photoBase64: base64 }),
      });
      const data = await resp.json();
      if (resp.ok && data.photo_url) {
        setIsSavedPhoto(true);
        onPhotoSaved?.(data.photo_url);
      }
    } catch {
      // silently fail
    }
    setSavingPhoto(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Image must be under 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setUserImage(base64);
        setResultImage(null);
        setShowingOriginal(false);
        setError(null);
        setIsSavedPhoto(false);
        // Auto-save to account if logged in
        if (customerToken) {
          savePhotoToAccount(base64);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const generateTryOn = async () => {
    if (!userImage || !outfitItems?.length) return;
    setIsProcessing(true);
    setError(null);

    try {
      const requestBody: Record<string, unknown> = {
        userImageBase64: userImage,
        outfitItems: outfitItems.map(i => ({
          name: i.name,
          imageUrl: i.imageUrl,
          category: i.category,
        })),
      };
      if (bodyShape) requestBody.bodyShape = bodyShape;
      if (sizeInfo && Object.values(sizeInfo).some(v => v)) requestBody.sizeInfo = sizeInfo;

      const { data, error: fnError } = await supabase.functions.invoke("virtual-tryon", {
        body: requestBody,
      });

      if (fnError) throw fnError;

      if (data?.success && data?.resultImage) {
        setResultImage(data.resultImage);
        setShowingOriginal(false);
      } else {
        setError(data?.message || "Could not generate try-on. Try a different photo.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to process. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!outfitItems || outfitItems.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center text-center gap-4 min-h-[400px]">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <Camera className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-base">No outfit selected</h3>
        <p className="text-sm text-muted-foreground max-w-[260px]">
          Go to the <strong>Outfits</strong> tab and tap <strong>"Try On"</strong> on any look to see how it looks on you.
        </p>
      </div>
    );
  }

  const displayImage = resultImage && !showingOriginal ? resultImage : userImage;
  const hasResult = !!resultImage;

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-base">Virtual Try-On</h3>
        <p className="text-xs text-muted-foreground">See how this outfit looks on you with AI</p>
      </div>

      {/* Outfit items preview */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {outfitItems.map((item, idx) => (
          <div key={idx} className="flex-shrink-0 w-20">
            <img src={item.imageUrl} alt={item.name} className="w-20 h-20 rounded-md object-cover border border-border" />
            <p className="text-[10px] text-muted-foreground truncate mt-1">{item.name}</p>
          </div>
        ))}
      </div>

      {/* Upload / Result area */}
      {!userImage ? (
        <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors">
          <Upload className="h-6 w-6 text-muted-foreground mb-2" />
          <span className="text-sm text-muted-foreground">Upload your photo</span>
          <span className="text-[11px] text-muted-foreground mt-1">JPG or PNG, max 5MB</span>
          <Input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        </label>
      ) : (
        <div className="relative">
          <img
            src={displayImage!}
            alt={hasResult && !showingOriginal ? "Try-on result" : "Your photo"}
            className="w-full aspect-[3/4] object-cover rounded-lg"
          />
          {/* Saved photo indicator */}
          {isSavedPhoto && !hasResult && (
            <Badge variant="secondary" className="absolute top-2 left-2 text-[10px] gap-1">
              <Save className="h-3 w-3" />
              Your saved photo
            </Badge>
          )}
          {/* Saving indicator */}
          {savingPhoto && (
            <Badge variant="secondary" className="absolute top-2 left-2 text-[10px] gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </Badge>
          )}
          {/* AI Generated badge */}
          {hasResult && !showingOriginal && (
            <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px]">
              <Sparkles className="h-3 w-3 mr-1" />
              AI Generated
            </Badge>
          )}
          {/* Toggle original/result */}
          {hasResult && (
            <button
              onClick={() => setShowingOriginal(!showingOriginal)}
              className="absolute bottom-2 left-2 h-7 px-2.5 bg-background/80 backdrop-blur-sm rounded-full flex items-center gap-1.5 text-[11px] font-medium text-foreground border border-border/50 hover:bg-background/95 transition-colors"
            >
              <Eye className="h-3 w-3" />
              {showingOriginal ? "View Result" : "View Original"}
            </button>
          )}
          {/* Clear button */}
          <button
            onClick={() => { setUserImage(null); setResultImage(null); setShowingOriginal(false); setIsSavedPhoto(false); }}
            className="absolute top-2 right-2 h-6 w-6 bg-background/80 rounded-full flex items-center justify-center"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Body profile indicator */}
      {bodyShape || (sizeInfo && Object.values(sizeInfo).some(v => v)) ? (
        <div className="flex items-center gap-1.5 text-xs text-primary">
          <User className="h-3 w-3" />
          <span>Personalized to your body profile</span>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Add your body shape and sizing in <strong>Account</strong> for better results
        </p>
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
            {hasResult ? "Try Again" : "Try It On"}
          </>
        )}
      </Button>
    </div>
  );
}
