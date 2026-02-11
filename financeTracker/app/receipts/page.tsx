'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ReceiptUpload } from '@/components/receipts/receipt-upload';
import { OCRResults } from '@/components/receipts/ocr-results';
import { Plus, ArrowLeft, Receipt, Calendar, Loader2, Trash2, FileText, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface Receipt {
  id: number;
  image_path: string;
  ocr_text: string | null;
  merchant_name: string | null;
  total_amount: number | null;
  receipt_date: string | null;
  confidence_score: number | null;
  is_processed: number;
  processing_status?: number;
  created_at: string;
  transaction_id: number | null;
  transaction_description: string | null;
}

export default function ReceiptsPage() {
  const [showUpload, setShowUpload] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchReceipts();
  }, []);

  const fetchReceipts = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/receipts');
      if (!response.ok) throw new Error('Failed to fetch receipts');
      const data = await response.json();
      setReceipts(data);
    } catch (error) {
      console.error('Error fetching receipts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadSuccess = (receiptId: number) => {
    setShowUpload(false);
    fetchReceipts();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (cents: number | null) => {
    if (!cents) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const handleDelete = async (receipt: Receipt, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete this receipt${receipt.merchant_name ? ` from ${receipt.merchant_name}` : ''}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/receipts/${receipt.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      fetchReceipts();
      if (selectedReceipt?.id === receipt.id) setSelectedReceipt(null);
    } catch (error) {
      alert('Failed to delete receipt');
    }
  };

  const getStatusBadge = (receipt: Receipt) => {
    if (receipt.is_processed === 1) {
      return <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">Done</span>;
    }
    if (receipt.processing_status === 1) {
      return <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">Processing</span>;
    }
    return <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Pending</span>;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-8xl mx-auto px-16 py-6 sm:px-16">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">Receipts</h1>
            </div>
            <div className="flex-1" />
            {/* Only show Upload button if we have receipts (otherwise upload shows automatically) */}
            {!showUpload && !selectedReceipt && receipts.length > 0 && (
              <Button size="sm" onClick={() => setShowUpload(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Upload
              </Button>
            )}
          </div>

          {/* Upload Component - shows when clicked OR when no receipts exist */}
          {(showUpload || (!isLoading && receipts.length === 0 && !selectedReceipt)) && (
            <ReceiptUpload
              onUploadSuccess={handleUploadSuccess}
              onCancel={receipts.length > 0 ? () => setShowUpload(false) : undefined}
            />
          )}
        </header>

        {/* Main Content */}
        <main>
          {selectedReceipt ? (
            <div className="space-y-4">
              {/* Back button */}
              <Button variant="ghost" size="sm" onClick={() => setSelectedReceipt(null)}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to list
              </Button>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Receipt Image - fixed height to match table */}
                <div className="border rounded-lg overflow-hidden bg-muted h-[820px]">
                  {selectedReceipt.image_path.toLowerCase().endsWith('.pdf') ? (
                    <iframe
                      src={`/api/receipts/images/${selectedReceipt.image_path.split('/').pop()}`}
                      className="w-full h-full border-0"
                      title="Receipt PDF"
                    />
                  ) : (
                    <img
                      src={`/api/receipts/images/${selectedReceipt.image_path.split('/').pop()}`}
                      alt="Receipt"
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>

                {/* OCR Results */}
                <OCRResults
                  receipt={selectedReceipt}
                  onCreateTransaction={() => {
                    // Navigate to transactions with pre-filled data
                    const params = new URLSearchParams({
                      from_receipt: selectedReceipt.id.toString(),
                      merchant: selectedReceipt.merchant_name || '',
                      amount: selectedReceipt.total_amount ? (selectedReceipt.total_amount / 100).toString() : '',
                      date: selectedReceipt.receipt_date || new Date().toISOString().split('T')[0],
                    });
                    window.location.href = `/transactions?${params.toString()}`;
                  }}
                />
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : receipts.length === 0 ? (
            // Upload component shows in header, no need for content here
            null
          ) : (
            /* Receipt List - Compact rows instead of large cards */
            <div className="border rounded-lg divide-y">
              {receipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedReceipt(receipt)}
                >
                  {/* Thumbnail - small */}
                  <div className="h-12 w-12 rounded-lg bg-muted border overflow-hidden shrink-0 flex items-center justify-center">
                    {receipt.image_path.toLowerCase().endsWith('.pdf') ? (
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <img
                        src={`/api/receipts/images/${receipt.image_path.split('/').pop()}`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">
                        {receipt.merchant_name || 'Unknown Merchant'}
                      </p>
                      {getStatusBadge(receipt)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {receipt.receipt_date ? formatDate(receipt.receipt_date) : formatDate(receipt.created_at)}
                      </span>
                      {receipt.transaction_id && (
                        <span className="text-primary">Linked</span>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right shrink-0">
                    {receipt.total_amount ? (
                      <p className="font-semibold text-sm">{formatCurrency(receipt.total_amount)}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">—</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => handleDelete(receipt, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
