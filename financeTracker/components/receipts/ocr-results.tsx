'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, AlertCircle, Sparkles, ArrowRight, Bell } from 'lucide-react';
import { ReceiptItemEditor } from './receipt-item-editor';
import { ReceiptItemsTable } from './receipt-items-table';

interface Receipt {
  id: number;
  image_path: string;
  ocr_text: string | null;
  merchant_name: string | null;
  total_amount: number | null;
  receipt_date: string | null;
  confidence_score: number | null;
  is_processed: number;
  parsed_data?: any;
  llm_used?: boolean;
  llm_provider?: string | null;
  processing_status?: number;
}

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

interface OCRResultsProps {
  receipt: Receipt;
  onCreateTransaction?: () => void;
}

export function OCRResults({ receipt, onCreateTransaction }: OCRResultsProps) {
  const [processingStatus, setProcessingStatus] = useState<'pending' | 'processing' | 'completed' | 'failed'>(
    receipt.processing_status === 1 ? 'processing' : 
    receipt.processing_status === 2 ? 'completed' : 
    receipt.processing_status === 3 ? 'failed' : 'pending'
  );
  const [error, setError] = useState<string | null>(null);
  const [processedReceipt, setProcessedReceipt] = useState<Receipt>(receipt);
  const [showNotification, setShowNotification] = useState(false);
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch receipt items
  const fetchReceiptItems = async () => {
    try {
      setItemsLoading(true);
      const response = await fetch(`/api/receipts/${receipt.id}/items`);
      if (response.ok) {
        const items = await response.json();
        setReceiptItems(items);
      }
    } catch (err) {
      console.error('Error fetching receipt items:', err);
    } finally {
      setItemsLoading(false);
    }
  };

  // Fetch items when receipt is already processed or when processing completes
  useEffect(() => {
    if (receipt.is_processed === 1 || processingStatus === 'completed') {
      fetchReceiptItems();
    }
  }, [receipt.id, receipt.is_processed, processingStatus]);

  // Check initial status on mount and when receipt changes
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/receipts/${receipt.id}/status`);
        if (response.ok) {
          const data = await response.json();
          const newStatus = data.status as 'pending' | 'processing' | 'completed' | 'failed';
          setProcessingStatus(newStatus);
          
          if (newStatus === 'completed' && data.is_processed) {
            // Update receipt with completed data
            setProcessedReceipt(prev => ({
              ...prev,
              is_processed: 1,
              ocr_text: data.ocr_text,
              merchant_name: data.merchant_name,
              total_amount: data.total_amount,
              receipt_date: data.receipt_date,
              confidence_score: data.confidence_score,
              parsed_data: data.parsed_data,
            }));
          } else if (newStatus === 'failed') {
            setError('OCR processing failed. Please try again.');
          } else if (newStatus === 'processing') {
            // If already processing, start polling
            // (polling useEffect will handle this)
          }
        }
      } catch (err) {
        console.error('Error checking status:', err);
      }
    };

    // Check status immediately on mount
    checkStatus();
  }, [receipt.id]);

  // Poll for status updates when processing
  useEffect(() => {
    if (processingStatus === 'processing') {
      pollingIntervalRef.current = setInterval(async () => {
        try {
          const response = await fetch(`/api/receipts/${receipt.id}/status`);
          if (response.ok) {
            const data = await response.json();
            const newStatus = data.status as 'pending' | 'processing' | 'completed' | 'failed';
            setProcessingStatus(newStatus);
            
            if (newStatus === 'completed' && data.is_processed) {
              // Stop polling
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
              
              // Update receipt with completed data
              setProcessedReceipt(prev => ({
                ...prev,
                is_processed: 1,
                ocr_text: data.ocr_text,
                merchant_name: data.merchant_name,
                total_amount: data.total_amount,
                receipt_date: data.receipt_date,
                confidence_score: data.confidence_score,
                parsed_data: data.parsed_data,
              }));
              
              // Show notification
              setShowNotification(true);
              
              // Request browser notification permission and show notification
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Receipt Processing Complete', {
                  body: `Receipt from ${data.merchant_name || 'Unknown merchant'} has been processed successfully.`,
                  icon: '/icon-192x192.png',
                });
              } else if ('Notification' in window && Notification.permission !== 'denied') {
                Notification.requestPermission().then((permission) => {
                  if (permission === 'granted') {
                    new Notification('Receipt Processing Complete', {
                      body: `Receipt from ${data.merchant_name || 'Unknown merchant'} has been processed successfully.`,
                      icon: '/icon-192x192.png',
                    });
                  }
                });
              }
            } else if (newStatus === 'failed') {
              // Stop polling on failure
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
              }
              setError('OCR processing failed. Please try again.');
            }
          }
        } catch (err) {
          console.error('Error polling status:', err);
        }
      }, 2000); // Poll every 2 seconds
    } else {
      // Stop polling if not processing
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [processingStatus, receipt.id]);

  const handleProcess = async () => {
    setError(null);
    setProcessingStatus('processing');

    try {
      const response = await fetch(`/api/receipts/${receipt.id}/process`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start receipt processing');
      }

      const data = await response.json();
      // Processing started successfully - polling will handle updates
      setShowNotification(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start receipt processing');
      setProcessingStatus('failed');
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'N/A';
    // Database stores cents, convert to dollars
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const isProcessed = processedReceipt.is_processed === 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          OCR Results
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {showNotification && processingStatus === 'completed' && (
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-500 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span>Receipt processing complete! You can continue working.</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNotification(false)}
              className="h-6 px-2"
            >
              Dismiss
            </Button>
          </div>
        )}

        {processingStatus === 'pending' && (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-4">
              This receipt hasn't been processed yet. Click below to extract information using OCR.
            </p>
            <Button onClick={handleProcess}>
              <Sparkles className="h-4 w-4 mr-2" />
              Process with OCR
            </Button>
          </div>
        )}

        {processingStatus === 'processing' && (
          <div className="text-center py-6">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
            <p className="text-sm text-muted-foreground font-medium">
              Processing receipt in background...
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              You can continue working. We'll notify you when it's complete.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              This may take 30-60 seconds
            </p>
          </div>
        )}

        {processingStatus === 'failed' && (
          <div className="text-center py-6">
            <AlertCircle className="h-8 w-8 mx-auto mb-3 text-destructive" />
            <p className="text-sm text-muted-foreground mb-4">
              Processing failed. Please try again.
            </p>
            <Button onClick={handleProcess} variant="outline">
              <Sparkles className="h-4 w-4 mr-2" />
              Retry Processing
            </Button>
          </div>
        )}

        {(processingStatus === 'completed' || processedReceipt.is_processed === 1) && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-500 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              <span>Receipt processed successfully</span>
              {processedReceipt.llm_used && (
                <span className="text-xs text-muted-foreground">
                  • Parsed with {processedReceipt.llm_provider}
                </span>
              )}
            </div>

            {/* Show Receipt Items Table if we have items from database */}
            {receiptItems.length > 0 ? (
              <ReceiptItemsTable
                items={receiptItems}
                total={processedReceipt.total_amount}
                receiptId={receipt.id}
                onItemsChange={fetchReceiptItems}
                onCreateTransaction={onCreateTransaction}
              />
            ) : itemsLoading ? (
              <div className="text-center py-4">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">Loading items...</p>
              </div>
            ) : (
              /* Fallback to basic OCR results */
              <div className="space-y-4">
                {/* Extracted Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Merchant Name</p>
                    <p className="font-medium">
                      {processedReceipt.merchant_name || 'Not detected'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Amount</p>
                    <p className="font-medium text-lg">
                      {formatCurrency(processedReceipt.total_amount)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="font-medium">
                      {formatDate(processedReceipt.receipt_date)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Confidence Score</p>
                    <p className="font-medium">
                      {processedReceipt.confidence_score
                        ? `${(processedReceipt.confidence_score * 100).toFixed(1)}%`
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* OCR Text */}
                {processedReceipt.ocr_text && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Extracted Text</p>
                    <div className="p-3 rounded-lg bg-muted text-sm max-h-32 overflow-y-auto">
                      {processedReceipt.ocr_text}
                    </div>
                  </div>
                )}

                {/* Create Transaction Button */}
                {onCreateTransaction && (
                  <Button onClick={onCreateTransaction} className="w-full">
                    Create Transaction from Receipt
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
