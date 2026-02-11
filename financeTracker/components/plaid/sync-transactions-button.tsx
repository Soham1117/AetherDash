'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SyncTransactionsButtonProps {
  onSync?: () => void;
}

export function SyncTransactionsButton({ onSync }: SyncTransactionsButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSync = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/plaid/sync', { method: 'POST' });
      const data = await res.json();
      
      if (res.ok) {
        if (data.message) {
          console.log(data.message);
          // Optional: You could use a toast notification here
          if (data.stats && data.stats.added === 0 && data.stats.modified === 0) {
             alert(data.message);
          }
        }
        console.log('Sync stats:', data.stats);
        if (onSync) onSync();
        router.refresh();
      } else {
        console.error('Sync failed:', data.error);
      }
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleSync} disabled={loading}>
      <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Syncing...' : 'Sync Transactions'}
    </Button>
  );
}
