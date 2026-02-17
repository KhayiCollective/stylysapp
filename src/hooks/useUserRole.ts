import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type AppRole = 'owner' | 'admin' | 'member';

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      if (!user) { setLoading(false); return; }
      try {
        const { data } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();
        setRole((data?.role as AppRole) ?? 'member');
      } catch {
        setRole('member');
      } finally {
        setLoading(false);
      }
    };
    fetchRole();
  }, [user]);

  const isDevUser = role === 'owner' || role === 'admin';

  return { role, isDevUser, loading };
}
