import { supabase } from "@/integrations/supabase/client";
import { useEmbeddedApp } from "@/components/EmbeddedAppProvider";

type InvokeOptions = Parameters<typeof supabase.functions.invoke>[1];

// Wraps supabase.functions.invoke for the embedded Shopify Admin context.
// When embedded, fetches a fresh App Bridge session token on every call and
// injects it as X-Shopify-Session-Token so edge functions can verify the caller.
// In non-embedded contexts, falls through to normal invoke() behavior unchanged.
export function useEmbeddedInvoke() {
  const { isEmbedded, getSessionToken } = useEmbeddedApp();

  return async function embeddedInvoke<T = unknown>(
    functionName: string,
    options?: InvokeOptions,
  ): Promise<{ data: T | null; error: Error | null }> {
    if (!isEmbedded) {
      return supabase.functions.invoke<T>(functionName, options);
    }

    const sessionToken = await getSessionToken();
    if (!sessionToken) {
      console.error("[useEmbeddedInvoke] Failed to get Shopify session token");
      return { data: null, error: new Error("Failed to get Shopify session token") };
    }

    return supabase.functions.invoke<T>(functionName, {
      ...options,
      headers: {
        ...options?.headers,
        "X-Shopify-Session-Token": sessionToken,
      },
    });
  };
}
