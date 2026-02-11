'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, CreditCard, Wallet, CircleDot, AlertCircle } from 'lucide-react';
import api from '../api';

interface Account {
  id: number;
  account_name: string;
  account_type: 'bank' | 'credit_card' | 'cash' | 'other';
  currency: string;
  balance: number;
  is_active: boolean;
  mask?: string | null;
}

interface AccountFormProps {
  account?: Account | null;
  onSave: () => void;
  onCancel: () => void;
}

const ACCOUNT_TYPES = [
  { value: 'bank', label: 'Bank Account', icon: Building2, description: 'Checking or savings account' },
  { value: 'credit_card', label: 'Credit Card', icon: CreditCard, description: 'Credit or debit card' },
  { value: 'cash', label: 'Cash', icon: Wallet, description: 'Physical cash on hand' },
  { value: 'other', label: 'Other', icon: CircleDot, description: 'Investment, loan, etc.' },
] as const;

export function AccountForm({ account, onSave, onCancel }: AccountFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('bank');
  const [balance, setBalance] = useState('0');
  const [mask, setMask] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!account;

  useEffect(() => {
    if (account) {
      setName(account.account_name);
      setType(account.account_type);
      // Django balance is accurate decimal, not cents.
      setBalance(account.balance.toString());
      setMask(account.mask || '');
    }
  }, [account]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter an account name');
      return;
    }

    if (!type) {
      setError('Please select an account type');
      return;
    }

    const balanceNum = parseFloat(balance) || 0;
    setIsSubmitting(true);

    try {
      const url = isEditMode ? `/accounts/${account.id}/` : '/accounts/';
      const method = isEditMode ? 'put' : 'post';

      // Use api utility
      await api[method](url, {
        account_name: name.trim(),
        account_type: type,
        balance: balanceNum,
        mask: mask || null,
        // currency default is USD in backend model
      });

      onSave();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditMode ? 'Edit Account' : 'Create New Account'}</CardTitle>
        <CardDescription>
          {isEditMode
            ? 'Update your account details below'
            : 'Add a new account to track your finances'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Account Name */}
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Account Name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Chase Checking"
              className="h-11"
              autoFocus
            />
          </div>

          {/* Account Type Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Account Type</label>
            <div className="grid grid-cols-2 gap-3">
              {ACCOUNT_TYPES.map((t) => {
                const Icon = t.icon;
                const isSelected = type === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={`
                      flex flex-col items-start gap-2 p-4 rounded-lg border-2 transition-all text-left
                      ${isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-accent/50'
                      }
                    `}
                  >
                    <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div>
                      <div className={`font-medium text-sm ${isSelected ? 'text-primary' : ''}`}>
                        {t.label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Last 4 Digits (Mask) */}
          <div className="space-y-2">
            <label htmlFor="mask" className="text-sm font-medium">
              Last 4 Digits (Optional)
            </label>
            <Input
              id="mask"
              value={mask}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                setMask(val);
              }}
              placeholder="1234"
              className="h-11 tracking-widest"
              maxLength={4}
            />
          </div>

          {/* Initial Balance */}
          <div className="space-y-2">
            <label htmlFor="balance" className="text-sm font-medium">
              {type === 'credit_card' ? 'Current Balance (Owed)' : 'Current Balance'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium pointer-events-none">
                $
              </span>
              <Input
                id="balance"
                type="number"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="0.00"
                className="pl-8 h-11 text-lg font-medium"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {type === 'credit_card' 
                ? 'Enter positive amount for what you owe.' 
                : 'Enter your current available funds.'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Account'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
