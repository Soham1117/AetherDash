"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BillSplitter } from "./editableTable";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

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

import { useDispatch, useSelector } from "react-redux";
import {
  setImage,
  setResult,
  setLoading,
  setError,
  reset,
} from "@/app/redux/receiptSlice";
import { RootState } from "@/app/redux/store";

const Page = () => {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const dispatch = useDispatch();
  const { image, result, loading, error } = useSelector(
    (state: RootState) => state.receipt
  );
  const [isPdf, setIsPdf] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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
    line_items?: any[];
  } | null>(null);
  const [splitData, setSplitData] = useState<any[]>([]);
  const router = useRouter();
  const { tokens } = useAuth();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files === null) return;
    const file = e.target.files[0];

    if (!file) return;
    
    // Clean up previous preview URL
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    
    // Check if file is PDF
    const fileIsPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    setIsPdf(fileIsPdf);
    
    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    
    dispatch(setImage(file));
    dispatch(setLoading(true));
    dispatch(setError(null));

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/receipts/process/`, {
        method: "POST",
        body: formData,
      });

      const rawData = await response.text();
      
      if (!response.ok) {
        // Try to parse error message from response
        let errorMessage = "Failed to process the receipt";
        try {
          const errorData = JSON.parse(rawData);
          errorMessage = errorData.error || errorData.details || errorMessage;
          if (errorData.details) {
            errorMessage += ` (${errorData.details})`;
          }
        } catch (e) {
          // If not JSON, use raw text or default message
          errorMessage = rawData || errorMessage;
        }
        throw new Error(errorMessage);
      }

      if (!/^[\x20-\x7E]*$/.test(rawData)) {
        throw new Error("Invalid JSON received");
      }
      const parsedData = JSON.parse(rawData);
      
      // Check if response has an error field (even with 200 status)
      if (parsedData.error) {
        throw new Error(parsedData.error);
      }
      
      dispatch(setResult(parsedData));
    } catch (err) {
      if (err instanceof Error) {
        dispatch(setError(err.message));
      } else {
        dispatch(setError("An unknown error occurred"));
      }
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleReset = () => {
    // Clean up preview URL to prevent memory leaks
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setIsPdf(false);
    dispatch(reset());
  };
  
  // Clean up preview URL on unmount
  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  React.useEffect(() => {
    const loadAccounts = async () => {
      if (!isTransactionDialogOpen || accountsLoading || accounts.length > 0) return;
      const accessToken = resolveAccessToken();
      if (!accessToken) {
        setTransactionError("Authentication required. Please log in again.");
        return;
      }

      setAccountsLoading(true);
      try {
        const accountsResponse = await fetch(`${API_URL}/accounts/`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!accountsResponse.ok) {
          throw new Error("Failed to fetch accounts");
        }

        const accountData = await accountsResponse.json();
        const normalizedAccounts = Array.isArray(accountData) ? accountData : [];
        setAccounts(normalizedAccounts);
        if (normalizedAccounts.length > 0) {
          setTransactionDraft((prev) =>
            prev && !prev.accountId
              ? { ...prev, accountId: normalizedAccounts[0].id.toString() }
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
  }, [isTransactionDialogOpen, accountsLoading, accounts.length, tokens?.access]);

  const resolveAccessToken = () => {
    const storedTokens = localStorage.getItem("authTokens");
    const tokenData = storedTokens ? JSON.parse(storedTokens) : null;
    return tokens?.access || tokenData?.access || "";
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
    if (!result) return;

    const accessToken = resolveAccessToken();
    if (!accessToken) {
      alert("Authentication required. Please log in again.");
      return;
    }

    const total = parseCurrencyAmount((result as any).totals?.total);
    const normalizedTotal = Math.round(total * 100) / 100;
    const merchantName = (result as any).merchant?.name || "Receipt";
    const receiptDate = normalizeReceiptDate(
      (result as any).transaction?.date || new Date().toISOString().split("T")[0]
    );

    // Generate line items from splits if available
    let lineItems: any[] = [];
    if (splitData && splitData.length > 0) {
      // Each person's share of each item becomes a line item.
      splitData.forEach((itemSplit, itemIdx) => {
        // Flattened list of items from BillSplitter logic: items, then taxes, then discounts
        const totalItemsCount = (result as any).items?.length || 0;
        const totalTaxesCount = (result as any).taxes?.length || 0;
        
        let originalItem: any;
        if (itemIdx < totalItemsCount) {
          originalItem = (result as any).items[itemIdx];
        } else if (itemIdx < totalItemsCount + totalTaxesCount) {
          originalItem = (result as any).taxes[itemIdx - totalItemsCount];
          originalItem = { ...originalItem, name: originalItem.type || 'Tax' };
        } else {
          originalItem = (result as any).discounts[itemIdx - totalItemsCount - totalTaxesCount];
          originalItem = { ...originalItem, name: originalItem.type || 'Discount' };
        }
        
        if (!originalItem) return;

        itemSplit.splits.forEach((amount: number, personIdx: number) => {
          if (amount <= 0) return;
          lineItems.push({
            name: `${originalItem.name || 'Item'} (Split - P${personIdx + 1})`,
            amount: amount,
            quantity: 1,
            category: originalItem.category || ((result as any).items?.[0] as any)?.category || "Shopping"
          });
        });
      });
    }

    setTransactionDraft({
      description: `${merchantName} - ${receiptDate}`,
      amount: normalizedTotal > 0 ? normalizedTotal.toFixed(2) : "",
      date: receiptDate,
      category: ((result as any).items?.[0] as any)?.category || "Shopping",
      accountId: accounts[0]?.id ? accounts[0].id.toString() : "",
      merchantName,
      isExpense: true,
      line_items: lineItems.length > 0 ? lineItems : undefined,
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

    const accessToken = resolveAccessToken();
    if (!accessToken) {
      setTransactionError("Authentication required. Please log in again.");
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
        line_items: transactionDraft.line_items,
      };

      const response = await fetch(`${API_URL}/transactions/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(transactionData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const fieldErrors =
          errorData && typeof errorData === "object"
            ? Object.entries(errorData)
                .map(([key, value]) => {
                  if (Array.isArray(value)) {
                    return `${key}: ${value.join(", ")}`;
                  }
                  return `${key}: ${value}`;
                })
                .join(" | ")
            : "";
        throw new Error(
          errorData.detail ||
            errorData.error ||
            fieldErrors ||
            "Failed to create transaction"
        );
      }

      await response.json();

      alert(
        `Transaction created successfully! Amount: $${Math.abs(amountValue).toFixed(2)}`
      );

      setIsTransactionDialogOpen(false);
      router.push("/transactions");
    } catch (error) {
      console.error("Error creating transaction:", error);
      setTransactionError(
        error instanceof Error ? error.message : formatTransactionError(error)
      );
    } finally {
      setIsCreatingTransaction(false);
    }
  };

    return (
          <div
            className={`flex flex-col items-start justify-start gap-8 font-sans min-h-[50vh] h-[60vh] w-full bg-[#121212] pt-4 mb-20 pl-24 pr-12`}
          >        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Receipts</h1>
          <p className="text-white/60 mt-1">
            Upload and process receipts to track expenses.
          </p>
        </div>
  
        <div className="flex flex-row items-start justify-center gap-8 w-full">
          <div className="flex flex-col w-3/4 p-8 items-center gap-3 justify-center border border-white/15 mt-12">
            <Label htmlFor="picture" className="flex w-full justify-start">
              Please upload a receipt:
            </Label>
            <div className="flex flex-row gap-2 items-center w-full">
              <Input
                id="picture"
                type="file"
                onChange={handleFileUpload}
                className="bg-transparent rounded-none"
                accept="image/*,application/pdf"
              />
              <Button
                onClick={handleReset}
                variant="outline"
                className=" text-white bg-[#121212] rounded-none hover:bg-[#161616]"
              >
                Reset
              </Button>
            </div>
            {loading ? (
              <div className="text-white">Processing receipt...</div>
            ) : error ? (
              <div className="text-red-500">{error}</div>
            ) : result ? (
              <div className="w-full space-y-4">
                <BillSplitter 
                  key={JSON.stringify(result)} 
                  initialReceipt={result} 
                  onSplitsChange={setSplitData}
                />
                <div className="flex justify-end pt-4 border-t border-white/15">
                  <Button
                    onClick={handleCreateTransaction}
                    disabled={isCreatingTransaction}
                    className="bg-[#1c1c1c] border border-white/15 text-white hover:bg-[#2b2b2b]"
                  >
                    {isCreatingTransaction ? "Creating..." : "Create Transaction"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex flex-col w-1/4 items-center justify-start border border-white/15 mt-12 h-full">
            {image && previewUrl ? (
              <>
                {isPdf ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-full min-h-[500px] border-0 p-6"
                    title="Receipt PDF"
                  />
                ) : (
                  <Image
                    src={previewUrl}
                    alt="Receipt"
                    width={370}
                    height={500}
                    className="p-6"
                    unoptimized
                  />
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-white/50">
                Receipt will appear here...
              </div>
            )}
          </div>
          <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
            <DialogContent className="sm:max-w-[560px] bg-[#121212] border-white/15 text-white">
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
      </div>
    );};

export default Page;
