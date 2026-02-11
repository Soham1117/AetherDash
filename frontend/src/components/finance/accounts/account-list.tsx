'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Pencil,
  Trash2,
  Building2,
  CreditCard,
  Wallet,
  CircleDot,
  RefreshCw,
  AlertCircle,
  Eraser
} from 'lucide-react';
import api from '../api'; // Relative import to api.ts

interface Account {
  id: number;
  account_name: string; // Mapped from name
  account_type: 'bank' | 'credit_card' | 'cash' | 'other';
  currency: string;
  balance: number; // Plaid-synced balance
  is_active: boolean; // boolean in Django
  mask?: string | null;
  subtype?: string | null;
}

interface AccountListProps {
  onEdit: (account: Account) => void;
  refreshTrigger?: number;
}

const TYPE_CONFIG = {
  bank: {
    label: 'Bank',
    icon: Building2,
    bgColor: 'bg-blue-500/10',
    iconColor: 'text-blue-500'
  },
  credit_card: {
    label: 'Credit Card',
    icon: CreditCard,
    bgColor: 'bg-purple-500/10',
    iconColor: 'text-purple-500'
  },
  cash: {
    label: 'Cash',
    icon: Wallet,
    bgColor: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500'
  },
  other: {
    label: 'Other',
    icon: CircleDot,
    bgColor: 'bg-muted',
    iconColor: 'text-muted-foreground'
  },
} as const;

function formatCurrency(amount: number, currency = 'USD'): string {
    // Django sends exact decimal amount, not cents.
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

export function AccountList({ onEdit, refreshTrigger }: AccountListProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Django endpoint: /accounts/ (GET)
      // Assuming api.ts baseURL is localhost:8000/api
      const response = await api.get('/accounts/');
      setAccounts(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts, refreshTrigger]);

  const handleDelete = async (account: Account) => {
    if (!confirm(`Delete "${account.account_name}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(account.id);
    try {
      await api.delete(`/accounts/${account.id}/`);
      fetchAccounts();
    } catch (err: any) {
      alert(err.response?.data?.detail || err.message || 'Failed to delete account');
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearTransactions = async (account: Account) => {
    if (!confirm(`Delete ALL transactions for "${account.account_name}"? This will also reset the balance to 0.`)) {
      return;
    }
    
    try {
      await api.post(`/accounts/${account.id}/clear_transactions/`);
      fetchAccounts();
    } catch (err: any) {
      alert(err.response?.data?.detail || err.message || 'Failed to clear transactions');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-none bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
                <div className="h-5 bg-muted rounded w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center gap-3">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Error loading accounts</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchAccounts}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="h-16 w-16 rounded-none bg-muted flex items-center justify-center">
              <Wallet className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No accounts yet</p>
              <p className="text-sm text-muted-foreground">
                Add your first account to start tracking your finances
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Separate accounts by type
  const creditCards = accounts.filter(a => a.account_type === 'credit_card');
  const bankAccounts = accounts.filter(a => a.account_type !== 'credit_card');

  const renderAccountCard = (account: Account) => {
      const typeConfig = TYPE_CONFIG[account.account_type] || TYPE_CONFIG.other;
      const Icon = typeConfig.icon;
      
      // Use the Plaid-synced balance directly for all account types
      const displayBalance = account.balance;

      return (
        <Card
          key={account.id}
          className="group hover:shadow-md transition-shadow bg-[#1c1c1c] border-white/15"
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div className={`h-12 w-12 rounded-none ${typeConfig.bgColor} flex items-center justify-center`}>
                <Icon className={`h-6 w-6 ${typeConfig.iconColor}`} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 text-white">
                <h3 className="font-medium truncate flex items-center gap-2 text-white">
                  {account.account_name}
                  {account.mask && (
                    <span className="text-white/60 text-sm font-normal tracking-wider">
                      •••• {account.mask}
                    </span>
                  )}
                </h3>
                <p className="text-sm text-white/60">{typeConfig.label}</p>
              </div>

              {/* Balance */}
              <div className="text-right">
                <p className={`font-semibold tabular-nums ${
                   Number(displayBalance) >= 0 ? 'text-white' : 'text-red-500' 
                }`}>
                  {formatCurrency(Number(displayBalance), account.currency)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEdit(account)}
                  title="Edit Account"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-yellow-500 hover:text-yellow-500 hover:bg-yellow-500/10"
                  onClick={() => handleClearTransactions(account)}
                  title="Clear All Transactions"
                >
                  <Eraser className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(account)}
                  disabled={deletingId === account.id}
                  title="Delete Account"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      );
  };

  return (
    <div className="space-y-6">
      <Card className="bg-[#1c1c1c] border-white/15">
        <CardContent className="p-5">
          <p className="text-sm text-white/60">Net Worth (Estimate)</p>
          <p className="text-3xl font-bold tracking-tight text-white">
            {formatCurrency(
              bankAccounts.reduce((sum, a) => sum + Number(a.balance), 0) - 
              // Assumption: Credit card balance is POSITIVE DEBT in Django?
              // The sync logic I wrote: 'balance': balance_val.
              // Plaid: current > 0 means debt.
              // So I should subtract it.
              creditCards.reduce((sum, a) => sum + Number(a.balance), 0)
            )}
          </p>
          <p className="text-sm text-white/50 mt-1">
            Across {accounts.length} account{accounts.length !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>

      {bankAccounts.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-3 flex items-center gap-2 text-white">
            <Building2 className="h-5 w-5 text-white/60" />
            Cash & Banking
          </h3>
          <div className="space-y-2">
            {bankAccounts.map(renderAccountCard)}
          </div>
        </div>
      )}

      {creditCards.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-3 flex items-center gap-2 text-white">
            <CreditCard className="h-5 w-5 text-white/60" />
            Credit Cards
          </h3>
          <div className="space-y-2">
            {creditCards.map(renderAccountCard)}
          </div>
        </div>
      )}
    </div>
  );
}
