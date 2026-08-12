import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEmbeddedApp } from '@/components/EmbeddedAppProvider';
import { useEmbeddedInvoke } from '@/hooks/useEmbeddedInvoke';
import { getTierByName, TierKey } from '@/lib/tiers';

interface SubscriptionState {
  subscribed: boolean;
  loading: boolean;
  tierName: TierKey | null;
  trialEnd: string | null;
  subscriptionEnd: string | null;
  isTrialing: boolean;
}

export function useSubscription() {
  const { session } = useAuth();
  const { isEmbedded } = useEmbeddedApp();
  const embeddedInvoke = useEmbeddedInvoke();
  const [state, setState] = useState<SubscriptionState>({
    subscribed: false,
    loading: true,
    tierName: null,
    trialEnd: null,
    subscriptionEnd: null,
    isTrialing: false,
  });

  const checkSubscription = useCallback(async () => {
    // Embedded callers authenticate via Shopify session token (handled inside
    // useEmbeddedInvoke); standalone callers need a Supabase auth session.
    if (!isEmbedded && !session?.access_token) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      const { data, error } = await embeddedInvoke<{
        subscribed: boolean;
        tier_name?: string;
        subscription_end?: string;
        is_trialing?: boolean;
      }>('check-subscription', {
        headers: isEmbedded ? undefined : { Authorization: `Bearer ${session!.access_token}` },
      });

      if (error) throw error;

      setState({
        subscribed: data?.subscribed ?? false,
        loading: false,
        tierName: data?.tier_name ? getTierByName(data.tier_name) : null,
        trialEnd: data?.subscription_end ?? null,
        subscriptionEnd: data?.subscription_end ?? null,
        isTrialing: data?.is_trialing ?? false,
      });
    } catch (err) {
      console.error('[useSubscription] Error:', err);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [session, isEmbedded, embeddedInvoke]);

  useEffect(() => {
    checkSubscription();
    const interval = setInterval(checkSubscription, 60_000);
    return () => clearInterval(interval);
  }, [checkSubscription]);

  return { ...state, checkSubscription };
}
