'use client';

import { useState, useEffect, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { TransactionForm } from '@/components/transactions/transaction-form';
import { TransactionList } from '@/components/transactions/transaction-list';
import { Plus, ArrowLeft, Receipt } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

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

function TransactionsPageContent() {
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [initialData, setInitialData] = useState<any>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const searchParams = useSearchParams();
  const router = useRouter();

  // Handle receipt conversion query params
  useEffect(() => {
    const fromReceiptId = searchParams.get('from_receipt');
    
    if (fromReceiptId && !showForm) {
      const fetchReceiptData = async () => {
        try {
          // Fetch receipt details
          const receiptRes = await fetch(`/api/receipts/${fromReceiptId}`);
          if (!receiptRes.ok) throw new Error('Failed to fetch receipt');
          const receipt = await receiptRes.json();
          
          // Fetch receipt items
          const itemsRes = await fetch(`/api/receipts/${fromReceiptId}/items`);
          let lineItems = [];
          if (itemsRes.ok) {
            lineItems = await itemsRes.json();
          }

          // Fetch accounts to try matching card
          const accountsRes = await fetch('/api/accounts');
          const accounts = await accountsRes.json();
          
          let matchedAccountId = 0;
          let description = `${receipt.merchant_name || 'Receipt'} Order - ${receipt.receipt_date || new Date().toISOString().split('T')[0]} - $${(receipt.total_amount / 100).toFixed(2)}`;
          
          // Try to match account/card
          let cardInfo = receipt.payment_method;
          let matchedAccount = null;

          // 1. Try matching with extracted payment method ("Visa 1234")
          if (cardInfo) {
             const lowerInfo = cardInfo.toLowerCase();
             // Look for account with matching digits
             const match = lowerInfo.match(/(\d{4})/);
             if (match) {
                 const lastFour = match[1];
                 matchedAccount = accounts.find((acc: any) => acc.name.includes(lastFour));
             }
             // Or matching type (e.g. "Visa") if account has it? (Too risky, many Visas)
          }

          // 2. Fallback: Search OCR text for account last 4 digits (if valid account names have digits)
          if (!matchedAccount && receipt.ocr_text) {
             const lowerOcr = receipt.ocr_text.toLowerCase();
             matchedAccount = accounts.find((acc: any) => {
               // extract last 4 digits from account name if present (e.g. "Chase ****1234")
               const match = acc.name.match(/(\d{4})/);
               if (match) {
                 const lastFour = match[1];
                 return lowerOcr.includes(lastFour);
               }
               return false;
             });
          }
             
          if (matchedAccount) {
            matchedAccountId = matchedAccount.id;
            description += ` (via ${matchedAccount.name})`;
          } else if (cardInfo) {
            description += ` (via ${cardInfo})`;
          }

          setInitialData({
            receipt_id: parseInt(fromReceiptId),
            merchant_name: receipt.merchant_name,
            amount: receipt.total_amount, // Keep in paise for form? No form expects string/float
            transaction_date: receipt.receipt_date || new Date().toISOString().split('T')[0],
            description: description,
            line_items: lineItems,
            account_id: matchedAccountId, // 0 means user selects
            is_expense: 1, // Default to expense
          });
          
          setEditingTransaction(null);
          setShowForm(true);
          
          // Clean up URL
          router.replace('/transactions');
        } catch (error) {
          console.error('Error loading receipt data:', error);
        }
      };
      
      fetchReceiptData();
    }
  }, [searchParams, showForm, router]);

  const handleAddNew = () => {
    setEditingTransaction(null);
    setInitialData(null);
    setShowForm(true);
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setInitialData(null);
    setShowForm(true);
  };

  const handleSave = () => {
    setShowForm(false);
    setEditingTransaction(null);
    setInitialData(null);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingTransaction(null);
    setInitialData(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Receipt className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
                  <p className="text-sm text-muted-foreground">Track your expenses and income</p>
                </div>
              </div>
            </div>
            {!showForm && (
              <Button onClick={handleAddNew}>
                <Plus className="h-4 w-4 mr-2" />
                Add Transaction
              </Button>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main>
          {showForm ? (
            <TransactionForm
              transaction={editingTransaction}
              initialData={initialData}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          ) : (
            <TransactionList onEdit={handleEdit} refreshTrigger={refreshTrigger} />
          )}
        </main>
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TransactionsPageContent />
    </Suspense>
  );
}
