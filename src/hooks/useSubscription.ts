import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
  const [state, setState] = useState<SubscriptionState>({
    subscribed: false,
    loading: true,
    tierName: null,
    trialEnd: null,
    subscriptionEnd: null,
    isTrialing: false,
  });

  const checkSubscription = useCallback(async () => {
    if (!session?.access_token) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      setState({
        subscribed: data.subscribed ?? false,
        loading: false,
        tierName: data.tier_name ? getTierByName(data.tier_name) : null,
        trialEnd: data.subscription_end ?? null,
        subscriptionEnd: data.subscription_end ?? null,
        isTrialing: data.is_trialing ?? false,
      });
    } catch (err) {
      console.error('[useSubscription] Error:', err);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [session?.access_token]);

  useEffect(() => {
    checkSubscription();
    const interval = setInterval(checkSubscription, 60_000);
    return () => clearInterval(interval);
  }, [checkSubscription]);

  return { ...state, checkSubscription };
}
