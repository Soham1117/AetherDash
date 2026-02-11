'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Upload, FileText, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ReceiptItemEditor } from '@/components/finance/receipts/receipt-item-editor';
import { useCategories } from '@/context/CategoryContext';
// import { ReceiptList } from '@/components/finance/receipts/receipt-list'; 
import api from '@/components/finance/api';

const normalizeReceiptDate = (value?: string | null) => {
  if (!value) return new Date().toISOString().split("T")[0];
  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parts = trimmed.split(/[\\/.\\-]/);
  if (parts.length >= 3) {
    let [p1, p2, p3] = parts;
    if (p3.length === 2) {
      p3 = `20${p3}`;
    }
    const num1 = parseInt(p1, 10);
    const num2 = parseInt(p2, 10);
    const year = parseInt(p3, 10);
    if (!Number.isNaN(num1) && !Number.isNaN(num2) && !Number.isNaN(year)) {
      let month = num1;
      let day = num2;
      if (num1 > 12 && num2 <= 12) {
        day = num1;
        month = num2;
      }
      return `${year.toString().padStart(4, "0")}-${month
        .toString()
        .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    }
  }

  const fallback = new Date(trimmed);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback.toISOString().split("T")[0];
  }

  return new Date().toISOString().split("T")[0];
};

const parseCurrencyAmount = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const parsed = Number.parseFloat(cleaned);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
};

export default function ReceiptsPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [isCreatingTransaction, setIsCreatingTransaction] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Array<{ id: number; account_name: string }>>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [transactionDraft, setTransactionDraft] = useState<{
    description: string;
    amount: string;
    date: string;
    category: string;
    accountId: string;
    merchantName: string;
    isExpense: boolean;
  } | null>(null);
  const { getCategoryName } = useCategories();
  const router = useRouter();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file); // Use 'file' or expected key

    try {
      // Endpoint: /receipts/process/ (Django receipts view)
      // I need to ensure this endpoint exists or use api.post
      const response = await api.post('/receipts/process/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      // Check if response has an error field
      if (response.data.error) {
        alert(`Error: ${response.data.error}`);
        return;
      }
      
      setParsedData(response.data);
    } catch (error: any) {
      console.error('Upload failed', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to process receipt.';
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (data: any) => {
    try {
        await api.post('/receipts/save/', data);
        setParsedData(null);
        alert('Receipt saved!');
        // Refresh list
    } catch (error) {
        console.error('Save failed', error);
        alert('Failed to save receipt.');
    }
  };

  const formatTransactionError = (error: any) => {
    const data = error?.response?.data;
    if (data && typeof data === "object") {
      const fieldErrors = Object.entries(data)
        .map(([key, value]) => {
          if (Array.isArray(value)) {
            return `${key}: ${value.join(", ")}`;
          }
          return `${key}: ${value}`;
        })
        .join(" | ");
      return data.detail || data.error || fieldErrors || "Failed to create transaction";
    }
    return error?.message || "Failed to create transaction";
  };

  const handleCreateTransaction = () => {
    if (!parsedData) return;

    const total = parseCurrencyAmount(parsedData.totals?.total);
    const normalizedTotal = Math.round(total * 100) / 100;
    const merchantName = parsedData.merchant?.name || "Receipt";
    const receiptDate = normalizeReceiptDate(
      parsedData.transaction?.date || new Date().toISOString().split("T")[0]
    );

    setTransactionDraft({
      description: `${merchantName} - ${receiptDate}`,
      amount: normalizedTotal > 0 ? normalizedTotal.toFixed(2) : "",
      date: receiptDate,
      category: "Uncategorized",
      accountId: accounts[0]?.id ? accounts[0].id.toString() : "",
      merchantName,
      isExpense: true,
    });
    setTransactionError(null);
    setIsTransactionDialogOpen(true);
  };

  const submitTransaction = async () => {
    if (!transactionDraft) return;

    if (!transactionDraft.accountId) {
      setTransactionError("Please select an account.");
      return;
    }

    const amountValue = parseCurrencyAmount(transactionDraft.amount);
    if (!amountValue || amountValue <= 0) {
      setTransactionError("Please enter a valid amount.");
      return;
    }

    setIsCreatingTransaction(true);
    setTransactionError(null);

    try {
      const signedAmount = transactionDraft.isExpense
        ? -Math.abs(amountValue)
        : Math.abs(amountValue);
      const transactionData = {
        name:
          transactionDraft.description.trim() ||
          `${transactionDraft.merchantName || "Receipt"} - ${transactionDraft.date}`,
        amount: signedAmount.toFixed(2),
        date: normalizeReceiptDate(transactionDraft.date),
        category: transactionDraft.category.trim() || "Uncategorized",
        account: parseInt(transactionDraft.accountId, 10),
        merchant_name: transactionDraft.merchantName.trim() || undefined,
        line_items: parsedData.items.map((item: any) => ({
          name: item.name,
          amount: item.total_price,
          quantity: item.quantity,
          category: item.categoryId ? getCategoryName(parseInt(item.categoryId.toString())) : undefined
        })),
      };

      await api.post("/transactions/", transactionData);

      alert(
        `Transaction created successfully! Amount: $${Math.abs(amountValue).toFixed(2)}`
      );

      setIsTransactionDialogOpen(false);
      router.push("/transactions");
    } catch (error) {
      console.error("Error creating transaction:", error);
      setTransactionError(formatTransactionError(error));
    } finally {
      setIsCreatingTransaction(false);
    }
  };

  useEffect(() => {
    const loadAccounts = async () => {
      if (!isTransactionDialogOpen || accountsLoading || accounts.length > 0) return;
      setAccountsLoading(true);
      try {
        const response = await api.get("/accounts/");
        const accountData = Array.isArray(response.data) ? response.data : [];
        setAccounts(accountData);
        if (accountData.length > 0) {
          setTransactionDraft((prev) =>
            prev && !prev.accountId
              ? { ...prev, accountId: accountData[0].id.toString() }
              : prev
          );
        }
      } catch (error) {
        console.error("Failed to load accounts:", error);
        setTransactionError("Failed to load accounts. Please try again.");
      } finally {
        setAccountsLoading(false);
      }
    };

    loadAccounts();
  }, [isTransactionDialogOpen, accountsLoading, accounts.length]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <Link href="/finance">
                <Button variant="ghost" size="icon" className="rounded-none">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
             </Link>
             <h1 className="text-2xl font-bold">Receipts</h1>
          </div>
          <div>
            <Button variant="outline" className="relative">
              {!isUploading ? <Upload className="h-4 w-4 mr-2" /> : <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Upload Receipt
              <Input 
                type="file" 
                className="absolute inset-0 opacity-0 cursor-pointer" 
                onChange={handleFileUpload}
                accept="image/*,application/pdf"
                disabled={isUploading}
              />
            </Button>
          </div>
        </header>

        <main className="space-y-6">
          {parsedData ? (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Review Parsed Data</h2>
                    <Button variant="ghost" onClick={() => setParsedData(null)}>Cancel</Button>
                </div>
                <ReceiptItemEditor 
                    parsedData={parsedData} 
                    onSave={handleSave}
                    onCreateTransaction={handleCreateTransaction}
                />
            </div>
          ) : (
            <div className="text-center py-12 bg-muted/30 rounded-lg border-2 border-dashed">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-lg font-medium">No receipt selected</p>
              <p className="text-sm text-muted-foreground">Upload a receipt to extract items and expenses.</p>
            </div>
          )}
        </main>
      </div>
      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Review Transaction Details</DialogTitle>
            <DialogDescription>
              Adjust the details before saving this receipt as a transaction.
            </DialogDescription>
          </DialogHeader>

          {transactionError && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {transactionError}
            </div>
          )}

          <div className="grid gap-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={transactionDraft?.isExpense ? "default" : "outline"}
                className="flex-1"
                onClick={() =>
                  setTransactionDraft((prev) =>
                    prev ? { ...prev, isExpense: true } : prev
                  )
                }
              >
                Expense
              </Button>
              <Button
                type="button"
                variant={!transactionDraft?.isExpense ? "default" : "outline"}
                className="flex-1"
                onClick={() =>
                  setTransactionDraft((prev) =>
                    prev ? { ...prev, isExpense: false } : prev
                  )
                }
              >
                Income
              </Button>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="transaction-amount">Amount</Label>
              <Input
                id="transaction-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={transactionDraft?.amount ?? ""}
                onChange={(e) =>
                  setTransactionDraft((prev) =>
                    prev ? { ...prev, amount: e.target.value } : prev
                  )
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="transaction-description">Description</Label>
              <Input
                id="transaction-description"
                value={transactionDraft?.description ?? ""}
                onChange={(e) =>
                  setTransactionDraft((prev) =>
                    prev ? { ...prev, description: e.target.value } : prev
                  )
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="transaction-account">Account</Label>
              <select
                id="transaction-account"
                value={transactionDraft?.accountId ?? ""}
                onChange={(e) =>
                  setTransactionDraft((prev) =>
                    prev ? { ...prev, accountId: e.target.value } : prev
                  )
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={accountsLoading}
              >
                <option value="" disabled>
                  {accountsLoading ? "Loading accounts..." : "Select an account"}
                </option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id.toString()}>
                    {account.account_name}
                  </option>
                ))}
              </select>
              {!accountsLoading && accounts.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No accounts found. Create an account before adding transactions.
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="transaction-category">Category</Label>
              <Input
                id="transaction-category"
                value={transactionDraft?.category ?? ""}
                onChange={(e) =>
                  setTransactionDraft((prev) =>
                    prev ? { ...prev, category: e.target.value } : prev
                  )
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="transaction-date">Date</Label>
              <Input
                id="transaction-date"
                type="date"
                value={transactionDraft?.date ?? ""}
                onChange={(e) =>
                  setTransactionDraft((prev) =>
                    prev ? { ...prev, date: e.target.value } : prev
                  )
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="transaction-merchant">Merchant</Label>
              <Input
                id="transaction-merchant"
                value={transactionDraft?.merchantName ?? ""}
                onChange={(e) =>
                  setTransactionDraft((prev) =>
                    prev ? { ...prev, merchantName: e.target.value } : prev
                  )
                }
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsTransactionDialogOpen(false)}
              disabled={isCreatingTransaction}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitTransaction}
              disabled={isCreatingTransaction || accounts.length === 0}
            >
              {isCreatingTransaction ? "Creating..." : "Create Transaction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
