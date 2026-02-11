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
  MoreHorizontal,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface Account {
  id: number;
  name: string;
  type: 'bank' | 'credit_card' | 'cash' | 'other';
  currency: string;
  balance: number;
  is_active: number;
  mask?: string | null;
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

function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
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
      const response = await fetch('/api/accounts');
      if (!response.ok) {
        throw new Error('Failed to fetch accounts');
      }
      const data = await response.json();
      setAccounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts, refreshTrigger]);

  const handleDelete = async (account: Account) => {
    if (!confirm(`Delete "${account.name}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(account.id);
    try {
      const response = await fetch(`/api/accounts/${account.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete account');
      }

      fetchAccounts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete account');
    } finally {
      setDeletingId(null);
    }
  };

  // Calculate total balance
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-muted" />
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
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
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
  const creditCards = accounts.filter(a => a.type === 'credit_card');
  const bankAccounts = accounts.filter(a => a.type !== 'credit_card');

  const renderAccountCard = (account: Account) => {
      const typeConfig = TYPE_CONFIG[account.type];
      const Icon = typeConfig.icon;

      return (
        <Card
          key={account.id}
          className="group hover:shadow-md transition-shadow"
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div className={`h-12 w-12 rounded-xl ${typeConfig.bgColor} flex items-center justify-center`}>
                <Icon className={`h-6 w-6 ${typeConfig.iconColor}`} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate flex items-center gap-2">
                  {account.name}
                  {account.mask && (
                    <span className="text-muted-foreground text-sm font-normal tracking-wider">
                      •••• {account.mask}
                    </span>
                  )}
                </h3>
                <p className="text-sm text-muted-foreground">{typeConfig.label}</p>
              </div>

              {/* Balance */}
              <div className="text-right">
                <p className={`font-semibold tabular-nums ${
                   // For credit cards, usually debt is positive in DB (from Plaid), but check logic
                   // Here we treat positive as Asset for banks, negative as Debt? 
                   // Or Plaid sends positive current balance = debt.
                   account.balance >= 0 ? 'text-foreground' : 'text-red-500' 
                   // Changed color logic: let's stay neutral for positive, red for negative?
                   // Actually, if it's a credit card and balance is > 0, it means you OWE money. 
                   // Let's stick to standard: Green/Black for positive asset, Red for negative asset. 
                   // But if Plaid says +500 for CCard it means -$500 net worth.
                   // Let's just show the number for now.
                }`}>
                  {formatCurrency(account.balance)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEdit(account)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(account)}
                  disabled={deletingId === account.id}
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
      {/* Summary Card */}
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="p-5">
          <p className="text-sm opacity-80">Net Worth (Estimate)</p>
          <p className="text-3xl font-bold tracking-tight">
            {/* 
               Total Balance Calculation Logic:
               Bank (Asset): +Balance
               Credit Card (Liability): -Balance (if Plaid sends positive for owed)
            */}
            {formatCurrency(
              bankAccounts.reduce((sum, a) => sum + a.balance, 0) - 
              creditCards.reduce((sum, a) => sum + a.balance, 0)
            )}
          </p>
          <p className="text-sm opacity-70 mt-1">
            Across {accounts.length} account{accounts.length !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>

      {/* Cash & Banking */}
      {bankAccounts.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            Cash & Banking
          </h3>
          <div className="space-y-2">
            {bankAccounts.map(renderAccountCard)}
          </div>
        </div>
      )}

      {/* Credit Cards */}
      {creditCards.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
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
