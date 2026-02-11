'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Trash2, Plus, Edit2, Check, X, ShoppingCart, Tag } from 'lucide-react';
import { CategorySelect } from '../categories/category-select';
import { useCategories } from '@/context/CategoryContext';

interface LineItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  details: string | null;
  categoryId?: number | string;
}

interface ParsedReceipt {
  is_receipt: boolean;
  receipt_type: string;
  merchant: {
    name: string | null;
    address: string | null;
    phone: string | null;
  };
  transaction: {
    date: string | null;
    time: string | null;
    payment_method: string | null;
  };
  items: LineItem[];
  totals: {
    subtotal: number | null;
    tax: number | null;
    discount: number | null;
    total: number;
  };
  notes: string | null;
}

interface ReceiptItemEditorProps {
  parsedData: ParsedReceipt;
  onSave: (data: ParsedReceipt) => void;
  onCreateTransaction: () => void;
}

export function ReceiptItemEditor({ parsedData, onSave, onCreateTransaction }: ReceiptItemEditorProps) {
  const { getCategoryName } = useCategories();
  const [items, setItems] = useState<LineItem[]>(
    parsedData.items.map((item, idx) => ({ ...item, id: `item-${idx}` }))
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<LineItem>>({});

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleEdit = (item: LineItem) => {
    setEditingId(item.id);
    setEditForm(item);
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    
    setItems(items.map(item => 
      item.id === editingId 
        ? { 
            ...item, 
            ...editForm,
            total_price: (editForm.quantity || item.quantity) * (editForm.unit_price || item.unit_price)
          }
        : item
    ));
    setEditingId(null);
    setEditForm({});
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleDelete = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleAddItem = () => {
    const newItem: LineItem = {
      id: `item-${Date.now()}`,
      name: 'New Item',
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      details: null,
    };
    setItems([...items, newItem]);
    handleEdit(newItem);
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
    const tax = parsedData.totals.tax || 0;
    const discount = parsedData.totals.discount || 0;
    const total = subtotal + tax - discount;
    
    return { subtotal, tax, discount, total };
  };

  const totals = calculateTotals();

  const handleSaveAll = () => {
    const updatedData: ParsedReceipt = {
      ...parsedData,
      items,
      totals: {
        ...parsedData.totals,
        subtotal: totals.subtotal,
        total: totals.total,
      },
    };
    onSave(updatedData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Receipt Items
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Merchant Info */}
        <div className="p-3 rounded-lg bg-muted space-y-1">
          <p className="font-semibold">{parsedData.merchant.name || 'Unknown Merchant'}</p>
          {parsedData.transaction.date && (
            <p className="text-sm text-muted-foreground">
              Date: {parsedData.transaction.date}
              {parsedData.transaction.time && ` at ${parsedData.transaction.time}`}
            </p>
          )}
          <p className="text-xs text-muted-foreground capitalize">
            Type: {parsedData.receipt_type}
          </p>
        </div>

        {/* Items Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="w-20">Qty</TableHead>
                <TableHead className="w-24">Price</TableHead>
                <TableHead className="w-24">Total</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No items found. Click "Add Item" to add manually.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    {editingId === item.id ? (
                      <>
                        <TableCell>
                          <Input
                            value={editForm.name || ''}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <CategorySelect
                            value={editForm.categoryId || null}
                            onValueChange={(val) => setEditForm({ ...editForm, categoryId: val })}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <NumberInput
                            value={editForm.quantity || 0}
                            onValueChange={(val) => setEditForm({ ...editForm, quantity: parseInt(val) || 0 })}
                            min={1}
                            className="w-full justify-center"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={editForm.unit_price || ''}
                            onChange={(e) => setEditForm({ ...editForm, unit_price: parseFloat(e.target.value) })}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          {formatCurrency((editForm.quantity || 0) * (editForm.unit_price || 0))}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleSaveEdit}
                              className="h-7 w-7 p-0"
                            >
                              <Check className="h-4 w-4 text-emerald-500" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelEdit}
                              className="h-7 w-7 p-0"
                            >
                              <X className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.name}</p>
                            {item.details && (
                              <p className="text-xs text-muted-foreground">{item.details}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm px-2 py-1 rounded bg-muted">
                            {getCategoryName(item.categoryId ? parseInt(item.categoryId.toString()) : null)}
                          </span>
                        </TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{formatCurrency(item.unit_price)}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(item.total_price)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(item)}
                              className="h-7 w-7 p-0"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(item.id)}
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Add Item Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddItem}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>

        {/* Totals */}
        <div className="space-y-2 pt-4 border-t">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal:</span>
            <span>{formatCurrency(totals.subtotal)}</span>
          </div>
          {totals.tax > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax:</span>
              <span>{formatCurrency(totals.tax)}</span>
            </div>
          )}
          {totals.discount > 0 && (
            <div className="flex justify-between text-sm text-emerald-600">
              <span>Discount:</span>
              <span>-{formatCurrency(totals.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold pt-2 border-t">
            <span>Total:</span>
            <span>{formatCurrency(totals.total)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button onClick={handleSaveAll} variant="outline" className="flex-1">
            Save Changes
          </Button>
          <Button onClick={onCreateTransaction} className="flex-1">
            Create Transaction
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
