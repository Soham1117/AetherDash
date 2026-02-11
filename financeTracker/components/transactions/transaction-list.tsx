'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Pencil,
  Trash2,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  Receipt,
  Calendar,
} from 'lucide-react';

interface Transaction {
  id: number;
  account_id: number;
  category_id: number | null;
  amount: number;
  transaction_date: string;
  description: string;
  notes: string | null;
  merchant_name: string | null;
  is_expense: number;
  account_name: string;
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
}

interface TransactionListProps {
  onEdit: (transaction: Transaction) => void;
  refreshTrigger?: number;
  accountId?: number;
  categoryId?: number;
}

function formatCurrency(paise: number): string {
  const dollars = paise / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    // Check if adding timezone offset helps, usually simpler to keep as is, but change locale
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  }
}

export function TransactionList({
  onEdit,
  refreshTrigger,
  accountId,
  categoryId,
}: TransactionListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (accountId) params.append('account_id', accountId.toString());
      if (categoryId) params.append('category_id', categoryId.toString());

      const response = await fetch(`/api/transactions?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }
      const data = await response.json();
      setTransactions(data.transactions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [accountId, categoryId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions, refreshTrigger]);

  const handleDelete = async (transaction: Transaction) => {
    if (!confirm(`Delete "${transaction.description}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(transaction.id);
    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete transaction');
      }

      fetchTransactions();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete transaction');
    } finally {
      setDeletingId(null);
    }
  };

  // Group transactions by date
  const groupedTransactions = transactions.reduce((groups, transaction) => {
    const date = transaction.transaction_date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(transaction);
    return groups;
  }, {} as Record<string, Transaction[]>);

  // Calculate totals
  const totalExpense = transactions
    .filter((t) => t.is_expense === 1)
    .reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = transactions
    .filter((t) => t.is_expense === 0)
    .reduce((sum, t) => sum + t.amount, 0);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-2/3" />
                  <div className="h-3 bg-muted rounded w-1/3" />
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
              <p className="font-medium text-destructive">Error loading transactions</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchTransactions}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
              <Receipt className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No transactions yet</p>
              <p className="text-sm text-muted-foreground">
                Add your first transaction to start tracking
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <p className="text-xs text-red-500 font-medium">Expenses</p>
            </div>
            <p className="text-xl font-bold text-red-500">
              {formatCurrency(totalExpense)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-500/10 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <p className="text-xs text-emerald-500 font-medium">Income</p>
            </div>
            <p className="text-xl font-bold text-emerald-500">
              {formatCurrency(totalIncome)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions by Date */}
      <div className="space-y-4">
        {Object.entries(groupedTransactions)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, dateTransactions]) => (
            <div key={date} className="space-y-2">
              {/* Date Header */}
              <div className="flex items-center gap-2 px-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-muted-foreground">
                  {formatDate(date)}
                </h3>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Transactions for this date */}
              <div className="space-y-2">
                {dateTransactions.map((transaction) => {
                  const isExpense = transaction.is_expense === 1;

                  return (
                    <Card
                      key={transaction.id}
                      className="group hover:shadow-md transition-shadow"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {/* Icon */}
                          <div
                            className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                              isExpense
                                ? 'bg-red-500/10'
                                : 'bg-emerald-500/10'
                            }`}
                          >
                            {transaction.category_icon ? (
                              <span className="text-2xl">
                                {transaction.category_icon}
                              </span>
                            ) : isExpense ? (
                              <TrendingDown className="h-6 w-6 text-red-500" />
                            ) : (
                              <TrendingUp className="h-6 w-6 text-emerald-500" />
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium truncate">
                              {transaction.description}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{transaction.account_name}</span>
                              {transaction.category_name && (
                                <>
                                  <span>•</span>
                                  <span>{transaction.category_name}</span>
                                </>
                              )}
                            </div>
                            {transaction.merchant_name && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {transaction.merchant_name}
                              </p>
                            )}
                          </div>

                          {/* Amount */}
                          <div className="text-right">
                            <p
                              className={`font-semibold tabular-nums ${
                                isExpense ? 'text-red-500' : 'text-emerald-500'
                              }`}
                            >
                              {isExpense ? '-' : '+'}
                              {formatCurrency(transaction.amount)}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => onEdit(transaction)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(transaction)}
                              disabled={deletingId === transaction.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
