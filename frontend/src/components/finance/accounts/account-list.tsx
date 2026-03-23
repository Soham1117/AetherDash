'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Pencil,
  Trash2,
  Building2,
  CreditCard,
  Wallet,
  CircleDot,
  RefreshCw,
  AlertCircle,
  Eraser,
  TriangleAlert,
  Settings2,
  Save,
  Loader2,
} from 'lucide-react';
import api from '../api';

interface Account {
  id: number;
  account_name: string;
  account_type: 'bank' | 'credit_card' | 'cash' | 'other';
  currency: string;
  balance: number;
  is_active: boolean;
  mask?: string | null;
  subtype?: string | null;
}

interface CreditCardUsageRow {
  account_id: number;
  account_name: string;
  credit_limit: number;
  current_balance: number;
  current_utilization_pct: number;
  target_statement_utilization_pct: number;
  target_statement_balance: number;
  pay_before_statement: number;
  statement_day: number | null;
  due_day: number | null;
  days_until_statement: number | null;
  days_until_due: number | null;
  warning_level: 'ok' | 'warning' | 'critical' | 'needs_setup';
  warning_text: string;
  notes: string;
}

interface ProfileFormState {
  credit_limit: string;
  target_statement_utilization_pct: string;
  statement_day: string;
  due_day: string;
  notes: string;
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
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function AccountList({ onEdit, refreshTrigger }: AccountListProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [creditUsageRows, setCreditUsageRows] = useState<Record<number, CreditCardUsageRow>>({});
  const [usageWarnings, setUsageWarnings] = useState<Array<{ account_id: number; account_name: string; level: string; message: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [settingsOpenFor, setSettingsOpenFor] = useState<Account | null>(null);
  const [settingsForm, setSettingsForm] = useState<ProfileFormState>({
    credit_limit: '',
    target_statement_utilization_pct: '6',
    statement_day: '',
    due_day: '',
    notes: '',
  });
  const [settingsSaving, setSettingsSaving] = useState(false);

  const fetchCreditUsage = useCallback(async () => {
    try {
      const response = await api.get('/accounts/credit-card-profiles/usage_checker/');
      const cards = response?.data?.cards || [];
      const map: Record<number, CreditCardUsageRow> = {};
      cards.forEach((row: CreditCardUsageRow) => {
        map[row.account_id] = row;
      });
      setCreditUsageRows(map);
      setUsageWarnings(response?.data?.warnings || []);
    } catch {
      setCreditUsageRows({});
      setUsageWarnings([]);
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.get('/accounts/');
      setAccounts(response.data);
      await fetchCreditUsage();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [fetchCreditUsage]);

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

  const openSettings = (account: Account) => {
    const row = creditUsageRows[account.id];
    setSettingsOpenFor(account);
    setSettingsForm({
      credit_limit: row?.credit_limit != null ? String(row.credit_limit) : '',
      target_statement_utilization_pct: row?.target_statement_utilization_pct != null ? String(row.target_statement_utilization_pct) : '6',
      statement_day: row?.statement_day != null ? String(row.statement_day) : '',
      due_day: row?.due_day != null ? String(row.due_day) : '',
      notes: row?.notes || '',
    });
  };

  const saveCardSettings = async () => {
    if (!settingsOpenFor) return;

    setSettingsSaving(true);
    try {
      await api.post('/accounts/credit-card-profiles/upsert/', {
        account: settingsOpenFor.id,
        credit_limit: settingsForm.credit_limit === '' ? 0 : Number(settingsForm.credit_limit),
        target_statement_utilization_pct:
          settingsForm.target_statement_utilization_pct === ''
            ? 6
            : Number(settingsForm.target_statement_utilization_pct),
        statement_day: settingsForm.statement_day === '' ? null : Number(settingsForm.statement_day),
        due_day: settingsForm.due_day === '' ? null : Number(settingsForm.due_day),
        notes: settingsForm.notes,
      });
      setSettingsOpenFor(null);
      await fetchCreditUsage();
    } catch (err: any) {
      alert(err.response?.data?.detail || JSON.stringify(err.response?.data) || 'Failed to save card settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-muted" />
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
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
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

  const creditCards = accounts.filter(a => a.account_type === 'credit_card');
  const bankAccounts = accounts.filter(a => a.account_type !== 'credit_card');

  const renderAccountCard = (account: Account) => {
    const typeConfig = TYPE_CONFIG[account.account_type] || TYPE_CONFIG.other;
    const Icon = typeConfig.icon;
    const displayBalance = account.balance;
    const profile = creditUsageRows[account.id];

    return (
      <Card
        key={account.id}
        className="group border-white/15 bg-[#1c1c1c] transition-shadow hover:shadow-md"
      >
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${typeConfig.bgColor}`}>
              <Icon className={`h-6 w-6 ${typeConfig.iconColor}`} />
            </div>

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
              {account.account_type === 'credit_card' && profile && (
                <div className="mt-1 text-xs text-white/70">
                  Util: {profile.current_utilization_pct}% • Target: {profile.target_statement_utilization_pct}%
                  {profile.days_until_statement != null && ` • Statement in ${profile.days_until_statement}d`}
                  {profile.days_until_due != null && ` • Due in ${profile.days_until_due}d`}
                </div>
              )}
              {account.account_type === 'credit_card' && profile?.warning_text && (
                <div className={`mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${
                  profile.warning_level === 'critical'
                    ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                    : 'bg-yellow-500/15 text-yellow-200 border border-yellow-500/30'
                }`}>
                  <TriangleAlert className="h-3.5 w-3.5" />
                  {profile.warning_text}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 sm:ml-auto sm:justify-end">
              <div className="text-right">
                <p className={`font-semibold tabular-nums ${
                  Number(displayBalance) >= 0 ? 'text-white' : 'text-red-500'
                }`}>
                  {formatCurrency(Number(displayBalance), account.currency)}
                </p>
              </div>

              <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                {account.account_type === 'credit_card' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-purple-300 hover:bg-purple-500/10 hover:text-purple-200"
                    onClick={() => openSettings(account)}
                    title="Credit Card Settings"
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                )}
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
                  className="h-8 w-8 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-500"
                  onClick={() => handleClearTransactions(account)}
                  title="Clear All Transactions"
                >
                  <Eraser className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleDelete(account)}
                  disabled={deletingId === account.id}
                  title="Delete Account"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <div className="space-y-6">
        <Card className="rounded-xl border-white/15 bg-[#1c1c1c]">
          <CardContent className="p-4 sm:p-5">
            <p className="text-sm text-white/60">Net Worth (Estimate)</p>
            <p className="text-3xl font-bold tracking-tight text-white">
              {formatCurrency(
                bankAccounts.reduce((sum, a) => sum + Number(a.balance), 0) -
                creditCards.reduce((sum, a) => sum + Number(a.balance), 0)
              )}
            </p>
            <p className="text-sm text-white/50 mt-1">
              Across {accounts.length} account{accounts.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        {usageWarnings.length > 0 && (
          <Card className="rounded-xl border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="p-4 sm:p-5">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-yellow-200">
                <TriangleAlert className="h-4 w-4" />
                Smart credit usage alerts
              </p>
              <div className="space-y-2">
                {usageWarnings.slice(0, 4).map((w) => (
                  <div key={`${w.account_id}-${w.message}`} className="rounded-md border border-white/10 bg-[#151515] p-2 text-sm text-white/80">
                    <span className="font-medium text-white">{w.account_name}:</span> {w.message}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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

      <Dialog open={!!settingsOpenFor} onOpenChange={(open) => !open && setSettingsOpenFor(null)}>
        <DialogContent className="sm:max-w-[520px] bg-[#121212] border-white/15 text-white">
          <DialogHeader>
            <DialogTitle>Credit settings · {settingsOpenFor?.account_name}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="credit_limit">Credit limit</Label>
              <Input
                id="credit_limit"
                type="number"
                min="0"
                step="0.01"
                value={settingsForm.credit_limit}
                onChange={(e) => setSettingsForm((s) => ({ ...s, credit_limit: e.target.value }))}
                className="bg-[#171717] border-white/15"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target_util">Target statement utilization %</Label>
              <Input
                id="target_util"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={settingsForm.target_statement_utilization_pct}
                onChange={(e) => setSettingsForm((s) => ({ ...s, target_statement_utilization_pct: e.target.value }))}
                className="bg-[#171717] border-white/15"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="statement_day">Statement day (1-31)</Label>
              <Input
                id="statement_day"
                type="number"
                min="1"
                max="31"
                value={settingsForm.statement_day}
                onChange={(e) => setSettingsForm((s) => ({ ...s, statement_day: e.target.value }))}
                className="bg-[#171717] border-white/15"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due_day">Due day (1-31)</Label>
              <Input
                id="due_day"
                type="number"
                min="1"
                max="31"
                value={settingsForm.due_day}
                onChange={(e) => setSettingsForm((s) => ({ ...s, due_day: e.target.value }))}
                className="bg-[#171717] border-white/15"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cc_notes">Notes</Label>
            <textarea
              id="cc_notes"
              value={settingsForm.notes}
              onChange={(e) => setSettingsForm((s) => ({ ...s, notes: e.target.value }))}
              rows={3}
              placeholder="e.g., autopay date, strategy, reminders"
              className="w-full rounded-md border border-white/15 bg-[#171717] px-3 py-2 text-sm outline-none focus:border-white/30"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSettingsOpenFor(null)} className="border-white/20 bg-transparent text-white hover:bg-white/10">
              Cancel
            </Button>
            <Button onClick={saveCardSettings} disabled={settingsSaving} className="bg-[#1f6feb] text-white hover:bg-[#2b7cff]">
              {settingsSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save settings
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
