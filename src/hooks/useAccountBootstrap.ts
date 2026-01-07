import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BootstrapResult {
  ok: boolean;
  brandId?: string;
  created?: boolean;
  error?: string;
}

export function useAccountBootstrap() {
  const [bootstrapping, setBootstrapping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bootstrap = useCallback(async (): Promise<BootstrapResult> => {
    setBootstrapping(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await supabase.functions.invoke('account-bootstrap', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Bootstrap failed');
      }

      const result = response.data as BootstrapResult;
      
      if (!result.ok) {
        throw new Error(result.error || 'Bootstrap failed');
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize account';
      setError(message);
      return { ok: false, error: message };
    } finally {
      setBootstrapping(false);
    }
  }, []);

  return { bootstrap, bootstrapping, error };
}
