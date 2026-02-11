'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AccountForm } from '@/components/accounts/account-form';
import { AccountList } from '@/components/accounts/account-list';
import { PlaidLinkButton } from '@/components/plaid/plaid-link-button';
import { SyncTransactionsButton } from '@/components/plaid/sync-transactions-button';
import { Plus, ArrowLeft, Wallet } from 'lucide-react';
import Link from 'next/link';

interface Account {
  id: number;
  name: string;
  type: 'bank' | 'credit_card' | 'cash' | 'other';
  currency: string;
  balance: number;
  is_active: number;
  mask?: string | null;
}

export default function AccountsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleAddNew = () => {
    setEditingAccount(null);
    setShowForm(true);
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setShowForm(true);
  };

  const handleSave = () => {
    setShowForm(false);
    setEditingAccount(null);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingAccount(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
                  <p className="text-sm text-muted-foreground">Manage your financial accounts</p>
                </div>
              </div>
            </div>
            {!showForm && (
              <div className="flex gap-2">
                <SyncTransactionsButton onSync={() => setRefreshTrigger((prev) => prev + 1)} />
                <PlaidLinkButton />
                <Button onClick={handleAddNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Manual
                </Button>
              </div>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main>
          {showForm ? (
            <AccountForm
              account={editingAccount}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          ) : (
            <AccountList onEdit={handleEdit} refreshTrigger={refreshTrigger} />
          )}
        </main>
      </div>
    </div>
  );
}
