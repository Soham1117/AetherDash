'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '../api';
import { PlaidLinkButton } from './plaid-link-button';

interface SyncTransactionsButtonProps {
  onSync?: () => void;
}

interface PlaidSyncError {
  item_id?: string | null;
  institution_id?: string | null;
  institution_name?: string | null;
  error_code?: string | null;
  error_type?: string | null;
  error_message?: string | null;
}

export function SyncTransactionsButton({ onSync }: SyncTransactionsButtonProps) {
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [syncErrors, setSyncErrors] = useState<PlaidSyncError[]>([]);
  const router = useRouter();

  const handleSync = async () => {
    try {
      setLoading(true);
      setSyncErrors([]);
      const res = await api.post('/plaid_integration/sync_transactions/');
      const data = res.data;
      const errors = Array.isArray(data.errors) ? (data.errors as PlaidSyncError[]) : [];
      setSyncErrors(errors);
      
      if (res.status === 200) {
        if (errors.length > 0) {
          const loginRequired = errors
            .filter((err: PlaidSyncError) => err.error_code === 'ITEM_LOGIN_REQUIRED')
            .map((err: PlaidSyncError) => err.institution_name || err.item_id || 'an institution');
          if (loginRequired.length > 0) {
            alert(`Some accounts need reconnection: ${loginRequired.join(', ')}.`);
          } else {
            alert('Some accounts failed to sync. Please try again.');
          }
        } else if (data.is_first_sync && data.added === 0) {
          alert('First sync completed, but no transactions found. This might mean the account has no transactions yet.');
        } else if (!data.is_first_sync && data.added === 0) {
          alert('No new transactions since last sync.');
        } else {
          alert(`Sync complete: ${data.added} added, ${data.modified} modified, ${data.removed} removed`);
        }
        console.log('Sync result:', data);
        if (onSync) onSync();
        router.refresh();
      } else {
        console.error('Sync failed:', data.error);
        alert(data.error || 'Sync failed');
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      alert(error.response?.data?.error || 'Sync failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSync = async () => {
    if (!confirm('Reset sync? This will trigger a full resync on the next sync, fetching all transactions from the beginning.')) {
      return;
    }

    try {
      setResetting(true);
      const res = await api.post('/plaid_integration/reset_sync/');
      const data = res.data;
      
      if (res.status === 200) {
        alert('Sync reset! Click "Sync Transactions" to perform a full resync.');
        console.log('Reset result:', data);
      } else {
        console.error('Reset failed:', data.error);
        alert(data.error || 'Reset failed');
      }
    } catch (error: any) {
      console.error('Reset error:', error);
      alert(error.response?.data?.error || 'Reset failed');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          onClick={handleSync} 
          disabled={loading || resetting}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Syncing...' : 'Sync Transactions'}
        </Button>
        <Button 
          variant="outline" 
          size="icon" 
          onClick={handleResetSync} 
          disabled={loading || resetting}
          title="Reset sync cursor to trigger full resync"
        >
          <RotateCcw className={`h-4 w-4 ${resetting ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      {syncErrors.length > 0 && (
        <div className="space-y-2 text-sm text-destructive">
          {syncErrors.map((err: PlaidSyncError) => (
            <div key={err.item_id || err.institution_id || err.error_code} className="flex flex-wrap items-center gap-2">
              <span>
                Sync error for {err.institution_name || 'bank'}: {err.error_code || 'UNKNOWN_ERROR'}
              </span>
              {err.error_code === 'ITEM_LOGIN_REQUIRED' && err.item_id && (
                <PlaidLinkButton
                  itemId={err.item_id}
                  label={`Reconnect ${err.institution_name || 'Bank'}`}
                  size="sm"
                  onLinked={handleSync}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
