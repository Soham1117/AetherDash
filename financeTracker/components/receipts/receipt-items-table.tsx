'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Pencil, Trash2, Check, X } from 'lucide-react';

interface ReceiptItem {
  id: number;
  receipt_id: number;
  name: string;
  clean_name: string | null;
  price: number;
  quantity: number;
  unit_price: number | null;
  category_id: number | null;
  category_suggestion: string | null;
  created_at: string;
}

interface Props {
  items: ReceiptItem[];
  total: number | null;
  receiptId: number;
  onItemsChange: () => void;
  onCreateTransaction?: () => void;
}

const CATEGORIES = [
  'Groceries', 'Personal Care', 'Household', 'Electronics', 
  'Dining', 'Transportation', 'Entertainment', 'Healthcare', 
  'Clothing', 'Tax', 'Fee', 'Discount', 'Other'
];

export function ReceiptItemsTable({ items, total, receiptId, onItemsChange, onCreateTransaction }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    clean_name: string;
    price: string;
    quantity: string;
    category_suggestion: string;
  }>({ clean_name: '', price: '', quantity: '', category_suggestion: '' });

  const startEdit = (item: ReceiptItem) => {
    setEditingId(item.id);
    setEditForm({
      clean_name: item.clean_name || item.name,
      price: (item.price / 100).toFixed(2),
      quantity: item.quantity.toString(),
      category_suggestion: item.category_suggestion || 'Other',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ clean_name: '', price: '', quantity: '', category_suggestion: '' });
  };

  const saveEdit = async (itemId: number) => {
    try {
      const response = await fetch(`/api/receipts/${receiptId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clean_name: editForm.clean_name,
          price: Math.round(parseFloat(editForm.price) * 100),
          quantity: parseFloat(editForm.quantity),
          category_suggestion: editForm.category_suggestion,
        }),
      });
      
      if (response.ok) {
        setEditingId(null);
        onItemsChange();
      }
    } catch (error) {
      console.error('Error saving item:', error);
    }
  };

  const deleteItem = async (itemId: number) => {
    if (!confirm('Delete this item?')) return;
    
    try {
      const response = await fetch(`/api/receipts/${receiptId}/items/${itemId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        onItemsChange();
      }
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  };

  return (
    <div className="space-y-3 w-full">
      <h4 className="font-medium text-sm">Line Items ({items.length})</h4>
      <div className="border rounded-lg overflow-hidden">
        {/* Scrollable body with themed scrollbar */}
        <div className="max-h-[650px] overflow-y-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-2 font-medium">Item</th>
              <th className="text-left p-2 font-medium">Category</th>
              <th className="text-right p-2 font-medium w-16">Qty</th>
              <th className="text-right p-2 font-medium w-20">Price</th>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t group">
                {editingId === item.id ? (
                  // Editing mode
                  <>
                    <td className="p-1">
                      <Input
                        value={editForm.clean_name}
                        onChange={(e) => setEditForm({ ...editForm, clean_name: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </td>
                    <td className="p-1">
                      <select
                        value={editForm.category_suggestion}
                        onChange={(e) => setEditForm({ ...editForm, category_suggestion: e.target.value })}
                        className="h-8 w-full rounded border bg-background px-2 text-sm"
                      >
                        {CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-1">
                      <NumberInput 
                        value={editForm.quantity}
                        onValueChange={(val) => setEditForm({ ...editForm, quantity: val })}
                        min={0.1}
                        step={1}
                        className="w-auto justify-center"
                      />
                    </td>
                    <td className="p-1">
                      <Input
                        type="number"
                        step="0.01"
                        value={editForm.price}
                        onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                        className="h-8 text-sm text-right w-20"
                      />
                    </td>
                    <td className="p-1">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(item.id)}>
                          <Check className="h-4 w-4 text-emerald-500" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </>
                ) : (
                  // View mode
                  <>
                    <td className="p-2">
                      <div>
                        <span className="font-medium">{item.clean_name || item.name}</span>
                        {item.clean_name && item.clean_name !== item.name && (
                          <span className="block text-xs text-muted-foreground truncate max-w-[180px]" title={item.name}>
                            {item.name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {item.category_suggestion || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="p-2 text-right">{item.quantity}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(item.price)}</td>
                    <td className="p-2">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(item)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteItem(item.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/50">
            {(() => {
              // Price is already the total for all quantities, don't multiply
              const calculatedTotal = items.reduce((sum, item) => sum + item.price, 0);
              const extractedTotal = total || 0;
              const diff = Math.abs(calculatedTotal - extractedTotal);
              const isMatch = diff <= 5; // Within $0.05 tolerance
              const colorClass = isMatch ? 'text-emerald-600' : 'text-red-500';
              
              return (
                <>
                  <tr className="border-t">
                    <td colSpan={3} className="p-2 text-right text-sm text-muted-foreground">Calculated Total</td>
                    <td className={`p-2 text-right font-bold ${colorClass}`}>{formatCurrency(calculatedTotal)}</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="p-2 text-right text-sm text-muted-foreground">Extracted Total</td>
                    <td className={`p-2 text-right font-bold ${colorClass}`}>{total ? formatCurrency(total) : '—'}</td>
                    <td></td>
                  </tr>
                  {!isMatch && (
                    <tr>
                      <td colSpan={3} className="p-2 text-right text-sm text-red-500">Difference</td>
                      <td className="p-2 text-right font-bold text-red-500">{formatCurrency(diff)}</td>
                      <td></td>
                    </tr>
                  )}
                  {isMatch && (
                    <tr>
                      <td colSpan={5} className="p-3">
                        <Button className="w-full" onClick={() => onCreateTransaction?.()}>
                          Create Transaction
                        </Button>
                      </td>
                    </tr>
                  )}
                </>
              );
            })()}
          </tfoot>
        </table>
        </div>
      </div>
    </div>
  );
}
