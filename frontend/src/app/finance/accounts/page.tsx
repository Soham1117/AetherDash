'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { AccountList } from '@/components/finance/accounts/account-list';
import { AccountForm } from '@/components/finance/accounts/account-form';
import { PlaidLinkButton } from '@/components/finance/plaid/plaid-link-button';
import { SyncTransactionsButton } from '@/components/finance/plaid/sync-transactions-button';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';

// Define Account interface here if not exported, or just use 'any' for simplicity in callback
// Ideally export from types.
interface Account {
  id: number;
  account_name: string;
  account_type: 'bank' | 'credit_card' | 'cash' | 'other';
  currency: string;
  balance: number;
  is_active: boolean;
  mask?: string | null;
}

export default function AccountsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSaved = () => {
    setIsCreateOpen(false);
    setEditingAccount(null);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleSync = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="flex flex-col gap-4 font-sans min-h-lvh w-full bg-[#121212] pt-4 mb-20 pl-24 pr-12">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Accounts</h1>
            <p className="text-white/60 mt-1">
              Manage your bank accounts, credit cards, and cash.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SyncTransactionsButton onSync={handleSync} />
            
            <div className="h-6 w-px bg-white/15 mx-1" />

            <PlaidLinkButton />

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#121212] border border-white/15 text-white rounded-none hover:bg-[#1c1c1c]">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Manual Account
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] bg-[#121212] border-white/15 text-white">
                <AccountForm
                  onSave={handleSaved}
                  onCancel={() => setIsCreateOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="border border-white/15 p-8">
          <AccountList
            refreshTrigger={refreshTrigger}
            onEdit={(account) => setEditingAccount(account)}
          />
        </div>

        <Dialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(null)}>
          <DialogContent className="sm:max-w-[425px] bg-[#121212] border-white/15 text-white">
            {editingAccount && (
              <AccountForm
                account={editingAccount}
                onSave={handleSaved}
                onCancel={() => setEditingAccount(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
