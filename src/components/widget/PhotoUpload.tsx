import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Upload, Camera, X, Loader2, Save, ImageIcon } from "lucide-react";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const CACHE_KEY_PREFIX = "stylys_photo_cache_";

interface PhotoUploadProps {
  brandId?: string;
  customerToken?: string | null;
  savedPhotoUrl?: string | null;
  onPhotoReady: (base64OrUrl: string, isSaved: boolean) => void;
  onPhotoCleared: () => void;
  onPhotoSaved?: (url: string) => void;
}

function getCacheKey(brandId?: string) {
  return `${CACHE_KEY_PREFIX}${brandId || "default"}`;
}

export function getCachedPhotoUrl(brandId?: string): string | null {
  try {
    return localStorage.getItem(getCacheKey(brandId));
  } catch {
    return null;
  }
}

export function setCachedPhotoUrl(brandId: string | undefined, url: string) {
  try {
    localStorage.setItem(getCacheKey(brandId), url);
  } catch { /* quota exceeded — ignore */ }
}

export function clearCachedPhoto(brandId?: string) {
  try {
    localStorage.removeItem(getCacheKey(brandId));
  } catch { /* ignore */ }
}

export function PhotoUpload({
  brandId,
  customerToken,
  savedPhotoUrl,
  onPhotoReady,
  onPhotoCleared,
  onPhotoSaved,
}: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveConsent, setSaveConsent] = useState(true);
  const [isSaved, setIsSaved] = useState(!!savedPhotoUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

  // Show saved photo as preview if present
  const displayImage = preview || savedPhotoUrl;
  const showingSaved = !preview && !!savedPhotoUrl;

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "Please upload a JPG, PNG, or WebP image.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "Image must be under 10MB.";
    }
    return null;
  };

  const processFile = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setPreview(base64);
      setIsSaved(false);
      onPhotoReady(base64, false);
    };
    reader.readAsDataURL(file);
  }, [onPhotoReady]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleClear = () => {
    setPreview(null);
    setIsSaved(false);
    setError(null);
    clearCachedPhoto(brandId);
    onPhotoCleared();
  };

  const handleSaveToAccount = async () => {
    if (!customerToken || !preview) return;
    setSaving(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/widget-customer-auth/photo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify({ photoBase64: preview }),
      });
      const data = await resp.json();
      if (resp.ok && data.photo_url) {
        setIsSaved(true);
        setCachedPhotoUrl(brandId, data.photo_url);
        onPhotoSaved?.(data.photo_url);
      }
    } catch {
      setError("Failed to save photo. Please try again.");
    }
    setSaving(false);
  };

  // Auto-save when consent is checked and a new photo is uploaded
  const handleConfirmAndSave = async () => {
    if (saveConsent && customerToken && preview && !isSaved) {
      await handleSaveToAccount();
    }
  };

  // --- No photo yet: upload area ---
  if (!displayImage) {
    return (
      <div className="space-y-3">
        <label
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center h-44 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
            isDragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border hover:border-primary/40 hover:bg-muted/20"
          }`}
        >
          <div className={`h-12 w-12 rounded-full flex items-center justify-center mb-3 transition-colors ${
            isDragging ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          }`}>
            <Upload className="h-6 w-6" />
          </div>
          <span className="text-sm font-medium text-foreground">
            {isDragging ? "Drop your photo here" : "Upload your full-body photo"}
          </span>
          <span className="text-[11px] text-muted-foreground mt-1">
            Drag & drop or tap to browse
          </span>
          <span className="text-[10px] text-muted-foreground mt-0.5">
            JPG, PNG, or WebP • Max 10MB
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  // --- Photo preview ---
  return (
    <div className="space-y-3">
      <div className="relative">
        <img
          src={displayImage}
          alt="Your photo"
          className="w-full aspect-[3/4] object-cover rounded-lg"
        />
        {showingSaved && (
          <Badge variant="secondary" className="absolute top-2 left-2 text-[10px] gap-1">
            <Save className="h-3 w-3" />
            Saved photo
          </Badge>
        )}
        {saving && (
          <Badge variant="secondary" className="absolute top-2 left-2 text-[10px] gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving to account...
          </Badge>
        )}
        {isSaved && !showingSaved && (
          <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] gap-1">
            <Save className="h-3 w-3" />
            Saved to account
          </Badge>
        )}
        <button
          onClick={handleClear}
          className="absolute top-2 right-2 h-7 w-7 bg-background/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-background/95 transition-colors"
          aria-label="Remove photo"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="absolute bottom-2 right-2 h-7 px-2.5 bg-background/80 backdrop-blur-sm rounded-full flex items-center gap-1.5 text-[11px] font-medium text-foreground border border-border/50 hover:bg-background/95 transition-colors"
        >
          <Camera className="h-3 w-3" />
          Change
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Consent checkbox — only show for logged-in users with a new photo */}
      {customerToken && preview && !isSaved && (
        <div className="space-y-2">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <Checkbox
              checked={saveConsent}
              onCheckedChange={(v) => setSaveConsent(!!v)}
              className="mt-0.5"
            />
            <span className="text-xs text-muted-foreground leading-relaxed">
              Save this photo to my account for future try-ons
            </span>
          </label>
          {saveConsent && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-xs"
              onClick={handleConfirmAndSave}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save Photo to Account
            </Button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
