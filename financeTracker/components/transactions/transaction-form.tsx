'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { X, Save, Loader2 } from 'lucide-react';

interface Account {
  id: number;
  name: string;
  type: string;
}

interface Category {
  id: number;
  name: string;
  parent_id: number | null;
  icon: string | null;
  color: string | null;
}

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
}

interface TransactionFormProps {
  transaction?: Transaction | null;
  initialData?: Partial<Transaction> & { receipt_id?: number; line_items?: any[] };
  onSave: () => void;
  onCancel: () => void;
}

export function TransactionForm({ transaction, initialData, onSave, onCancel }: TransactionFormProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    account_id: transaction?.account_id || initialData?.account_id || 0,
    category_id: transaction?.category_id || initialData?.category_id || 0,
    amount: transaction ? (transaction.amount / 100).toFixed(2) : initialData?.amount ? (initialData.amount / 100).toFixed(2) : '',
    transaction_date: transaction?.transaction_date || initialData?.transaction_date || new Date().toISOString().split('T')[0],
    description: transaction?.description || initialData?.description || '',
    notes: transaction?.notes || initialData?.notes || '',
    merchant_name: transaction?.merchant_name || initialData?.merchant_name || '',
    is_expense: transaction?.is_expense ?? initialData?.is_expense ?? 1,
    receipt_id: initialData?.receipt_id,
    line_items: initialData?.line_items,
  });

  useEffect(() => {
    // Fetch accounts and categories
    Promise.all([
      fetch('/api/accounts').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
    ]).then(([accountsData, categoriesData]) => {
      setAccounts(accountsData);
      setCategories(categoriesData);
      
      // Set default account if creating new transaction
      if (!transaction && accountsData.length > 0) {
        setFormData(prev => ({ ...prev, account_id: accountsData[0].id }));
      }
    }).catch(err => {
      console.error('Error fetching data:', err);
      setError('Failed to load accounts and categories');
    });
  }, [transaction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        category_id: formData.category_id || null,
        notes: formData.notes || null,
        merchant_name: formData.merchant_name || null,
      };

      const url = transaction
        ? `/api/transactions/${transaction.id}`
        : '/api/transactions';
      
      const method = transaction ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save transaction');
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold">
              {transaction ? 'Edit Transaction' : 'New Transaction'}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onCancel}
              className="rounded-full"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Type Toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={formData.is_expense === 1 ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setFormData({ ...formData, is_expense: 1 })}
            >
              Expense
            </Button>
            <Button
              type="button"
              variant={formData.is_expense === 0 ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setFormData({ ...formData, is_expense: 0 })}
            >
              Income
            </Button>
          </div>

          {/* Amount */}
          <div>
            <Label htmlFor="amount">
              Amount <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="pl-8"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Input
              id="description"
              type="text"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What was this for?"
            />
          </div>

          {/* Account */}
          <div>
            <Label htmlFor="account">
              Account <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.account_id.toString()}
              onValueChange={(value) => setFormData({ ...formData, account_id: parseInt(value) })}
              required
            >
              <SelectTrigger id="account">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id.toString()}>
                    {account.name} ({account.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category_id.toString()}
              onValueChange={(value) => setFormData({ ...formData, category_id: parseInt(value) })}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Uncategorized" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Uncategorized</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.icon ? `${category.icon} ` : ''}{category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div>
            <Label htmlFor="date">
              Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="date"
              type="date"
              required
              value={formData.transaction_date}
              onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
            />
          </div>

          {/* Merchant Name */}
          <div>
            <Label htmlFor="merchant">Merchant Name</Label>
            <Input
              id="merchant"
              type="text"
              value={formData.merchant_name}
              onChange={(e) => setFormData({ ...formData, merchant_name: e.target.value })}
              placeholder="Optional"
            />
          </div>

          {/* Line Items (Read Only for now) */}
          {formData.line_items && formData.line_items.length > 0 && (
            <div>
              <Label>Line Items ({formData.line_items.length})</Label>
              <div className="mt-2 border rounded-md overflow-hidden text-sm">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2 font-medium">Item</th>
                      <th className="text-right p-2 font-medium w-20">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {formData.line_items.map((item: any, i: number) => (
                      <tr key={i}>
                        <td className="p-2">
                          <div className="font-medium">{item.clean_name || item.name}</div>
                          {item.quantity > 1 && (
                            <div className="text-xs text-muted-foreground">Qty: {item.quantity}</div>
                          )}
                        </td>
                        <td className="p-2 text-right">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.price / 100)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional details..."
              className="min-h-[80px] resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {transaction ? 'Update' : 'Create'}
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
