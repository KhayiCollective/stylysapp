import { useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { WishlistApi } from "@/hooks/useWishlistItems";

interface WishlistHeartProps {
  wishlist?: WishlistApi;
  itemId?: string;
  className?: string;
}

/** Small heart button that saves/unsaves a single product. Renders nothing when the store's plan doesn't include the wishlist feature. */
export function WishlistHeart({ wishlist, itemId, className = "" }: WishlistHeartProps) {
  const [busy, setBusy] = useState(false);
  if (!wishlist?.enabled || !itemId) return null;
  const saved = wishlist.isSaved(itemId);

  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const r = await wishlist.toggle({ item_id: itemId });
    setBusy(false);
    if (!r.ok) {
      if (r.reason === "login") {
        toast("Sign in to save items", { description: "Open the Account tab to sign in or create your account.", position: "top-center" });
      } else {
        toast.error("Couldn't update your wishlist", { position: "top-center" });
      }
    }
  };

  return (
    <button
      type="button"
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      onClick={onClick}
      disabled={busy}
      className={`h-6 w-6 rounded-full bg-background/90 border border-border shadow flex items-center justify-center hover:bg-background ${className}`}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Heart className={`h-3 w-3 ${saved ? "fill-foreground" : ""}`} />}
    </button>
  );
}
