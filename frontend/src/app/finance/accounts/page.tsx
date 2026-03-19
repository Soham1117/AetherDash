'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { AccountList } from '@/components/finance/accounts/account-list';
import { AccountForm } from '@/components/finance/accounts/account-form';
import { PlaidLinkButton } from '@/components/finance/plaid/plaid-link-button';
import { SyncTransactionsButton } from '@/components/finance/plaid/sync-transactions-button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

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
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleSync = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="mx-auto mt-14 mb-12 w-full max-w-7xl space-y-5 px-4 font-sans text-white sm:px-6 lg:ml-24 lg:mt-16 lg:px-8">
      <header className="rounded-xl border border-white/15 bg-[#1a1a1a] p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Accounts</h1>
            <p className="mt-1 text-sm text-white/60">
              Manage your bank accounts, credit cards, and cash.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
            <SyncTransactionsButton onSync={handleSync} />
            <PlaidLinkButton />

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="h-10 rounded-lg border border-white/15 bg-[#121212] text-white hover:bg-[#1c1c1c]">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Manual Account
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] bg-[#121212] border-white/15 text-white">
                <AccountForm onSave={handleSaved} onCancel={() => setIsCreateOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-white/15 bg-[#171717] p-3 sm:p-4 lg:p-5">
        <AccountList
          refreshTrigger={refreshTrigger}
          onEdit={(account) => setEditingAccount(account)}
        />
      </section>

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
  );
}
