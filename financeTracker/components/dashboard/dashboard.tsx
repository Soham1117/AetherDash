'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Receipt,
  ArrowRight,
  Loader2,
  AlertCircle,
  Camera,
} from 'lucide-react';
import Link from 'next/link';

interface DashboardStats {
  totalBalance: number;
  accountCount: number;
  recentTransactions: Array<{
    id: number;
    amount: number;
    transaction_date: string;
    description: string;
    is_expense: number;
    account_name: string;
    category_name: string | null;
    category_icon: string | null;
  }>;
  monthly: {
    expense: number;
    income: number;
    transactionCount: number;
    netIncome: number;
  };
  categorySpending: Array<{
    id: number | null;
    name: string | null;
    icon: string | null;
    color: string | null;
    total: number;
    count: number;
  }>;
  topAccounts: Array<{
    id: number;
    name: string;
    type: string;
    balance: number;
    transaction_count: number;
  }>;
}

function formatCurrency(paise: number): string {
  const dollars = paise / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
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
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
    });
  }
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/dashboard');
      if (!response.ok) throw new Error('Failed to fetch dashboard stats');
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center gap-3">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-destructive">{error || 'Failed to load dashboard'}</p>
            <Button variant="outline" size="sm" onClick={fetchStats}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Balance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Balance
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalBalance)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {stats.accountCount} account{stats.accountCount !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        {/* Monthly Income */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Month Income
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              {formatCurrency(stats.monthly.income)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.monthly.transactionCount} transactions
            </p>
          </CardContent>
        </Card>

        {/* Monthly Expenses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Month Expenses
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {formatCurrency(stats.monthly.expense)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Net: {formatCurrency(stats.monthly.netIncome)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Transactions</CardTitle>
            <Link href="/transactions">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {stats.recentTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground h-[350px] flex flex-col items-center justify-center">
                <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-3 h-[350px] overflow-y-auto pr-2 scrollbar-thin">
                {stats.recentTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                          transaction.is_expense ? 'bg-red-500/10' : 'bg-emerald-500/10'
                        }`}
                      >
                        {transaction.category_icon ? (
                          <span className="text-lg">{transaction.category_icon}</span>
                        ) : transaction.is_expense ? (
                          <TrendingDown className="h-5 w-5 text-red-500" />
                        ) : (
                          <TrendingUp className="h-5 w-5 text-emerald-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{transaction.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {transaction.account_name} • {formatDate(transaction.transaction_date)}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`font-semibold tabular-nums ${
                        transaction.is_expense ? 'text-red-500' : 'text-emerald-500'
                      }`}
                    >
                      {transaction.is_expense ? '-' : '+'}
                      {formatCurrency(transaction.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Spending */}
        <Card>
          <CardHeader>
            <CardTitle>Top Categories (This Month)</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.categorySpending.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No expenses this month</p>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.categorySpending.map((category, index) => {
                  const percentage =
                    stats.monthly.expense > 0
                      ? (category.total / stats.monthly.expense) * 100
                      : 0;

                  return (
                    <div key={index}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {category.icon && (
                            <span className="text-lg">{category.icon}</span>
                          )}
                          <span className="text-sm font-medium">
                            {category.name || 'Uncategorized'}
                          </span>
                        </div>
                        <span className="text-sm font-semibold">
                          {formatCurrency(category.total)}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {category.count} transaction{category.count !== 1 ? 's' : ''} •{' '}
                        {percentage.toFixed(1)}%
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/transactions">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Receipt className="h-6 w-6 text-emerald-500" />
                </div>
                <div>
                  <p className="font-semibold">Add Transaction</p>
                  <p className="text-sm text-muted-foreground">Track an expense or income</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/receipts">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <Camera className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <p className="font-semibold">Upload Receipt</p>
                  <p className="text-sm text-muted-foreground">Scan and extract data</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/accounts">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="font-semibold">Manage Accounts</p>
                  <p className="text-sm text-muted-foreground">View and edit accounts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/categories">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <p className="font-semibold">Categories</p>
                  <p className="text-sm text-muted-foreground">Organize transactions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
