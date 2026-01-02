import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, RefreshCw, Webhook, Play, CheckCircle, XCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SyncHistoryEntry {
  id: string;
  sync_type: string;
  status: string;
  products_created: number;
  products_updated: number;
  products_deleted: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export function SyncHistoryLog() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<SyncHistoryEntry[]>([]);
  const [brandId, setBrandId] = useState<string | null>(null);

  useEffect(() => {
    const fetchBrandId = async () => {
      if (!user) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('brand_id')
          .eq('id', user.id)
          .single();

        if (profile?.brand_id) {
          setBrandId(profile.brand_id);
        }
      } catch (error) {
        console.error('Error fetching brand:', error);
      }
    };

    fetchBrandId();
  }, [user]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!brandId) return;

      try {
        const { data, error } = await supabase
          .from('sync_history')
          .select('*')
          .eq('brand_id', brandId)
          .order('started_at', { ascending: false })
          .limit(20);

        if (error) throw error;
        setHistory(data || []);
      } catch (error) {
        console.error('Error fetching sync history:', error);
      } finally {
        setLoading(false);
      }
    };

    if (brandId) {
      fetchHistory();

      // Subscribe to realtime updates
      const channel = supabase
        .channel('sync_history_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'sync_history',
            filter: `brand_id=eq.${brandId}`,
          },
          () => {
            fetchHistory();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [brandId]);

  const getSyncTypeIcon = (type: string) => {
    switch (type) {
      case 'manual':
        return <Play className="h-4 w-4" />;
      case 'webhook':
        return <Webhook className="h-4 w-4" />;
      case 'initial':
        return <RefreshCw className="h-4 w-4" />;
      default:
        return <History className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1 animate-pulse" />
            In Progress
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Sync History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Sync History
        </CardTitle>
        <CardDescription>
          Recent product synchronization events
        </CardDescription>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No sync history yet</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {history.map(entry => (
                <div
                  key={entry.id}
                  className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {getSyncTypeIcon(entry.sync_type)}
                      <span className="font-medium capitalize">{entry.sync_type} Sync</span>
                    </div>
                    {getStatusBadge(entry.status)}
                  </div>
                  
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-2">
                    {entry.products_created > 0 && (
                      <span className="text-success">+{entry.products_created} created</span>
                    )}
                    {entry.products_updated > 0 && (
                      <span className="text-blue-500">{entry.products_updated} updated</span>
                    )}
                    {entry.products_deleted > 0 && (
                      <span className="text-destructive">-{entry.products_deleted} deleted</span>
                    )}
                    {entry.products_created === 0 && entry.products_updated === 0 && entry.products_deleted === 0 && entry.status === 'completed' && (
                      <span>No changes</span>
                    )}
                  </div>

                  {entry.error_message && (
                    <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                      {entry.error_message}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(entry.started_at), { addSuffix: true })}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
