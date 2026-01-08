import { useEffect, useState } from 'react';
import { syncRuns } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export function useSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when coming online
      performSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync if online
    if (isOnline) {
      performSync();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const performSync = async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    setSyncProgress(null);
    try {
      const result = await syncRuns();
      if (result.synced > 0) {
        toast({
          title: 'Sync Complete',
          description: `Synced ${result.synced} runs to server`,
        });
      }
      if (result.errors > 0) {
        toast({
          title: 'Sync Failed',
          description: `Failed to sync ${result.errors} runs. Will retry later.`,
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  return { isOnline, isSyncing, syncProgress, syncNow: performSync };
}