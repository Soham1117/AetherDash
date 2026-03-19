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
import { UploadCloud } from "lucide-react";

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

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const fileIsPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    setIsPdf(fileIsPdf);

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
        let errorMessage = "Failed to process the receipt";
        try {
          const errorData = JSON.parse(rawData);
          errorMessage = errorData.error || errorData.details || errorMessage;
          if (errorData.details) {
            errorMessage += ` (${errorData.details})`;
          }
        } catch {
          errorMessage = rawData || errorMessage;
        }
        throw new Error(errorMessage);
      }

      if (!/^[\x20-\x7E]*$/.test(rawData)) {
        throw new Error("Invalid JSON received");
      }
      const parsedData = JSON.parse(rawData);

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
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setIsPdf(false);
    dispatch(reset());
  };

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

    let lineItems: any[] = [];
    if (splitData && splitData.length > 0) {
      splitData.forEach((itemSplit, itemIdx) => {
        const totalItemsCount = (result as any).items?.length || 0;
        const totalTaxesCount = (result as any).taxes?.length || 0;

        let originalItem: any;
        if (itemIdx < totalItemsCount) {
          originalItem = (result as any).items[itemIdx];
        } else if (itemIdx < totalItemsCount + totalTaxesCount) {
          originalItem = (result as any).taxes[itemIdx - totalItemsCount];
          originalItem = { ...originalItem, name: originalItem.type || "Tax" };
        } else {
          originalItem = (result as any).discounts[itemIdx - totalItemsCount - totalTaxesCount];
          originalItem = { ...originalItem, name: originalItem.type || "Discount" };
        }

        if (!originalItem) return;

        itemSplit.splits.forEach((amount: number, personIdx: number) => {
          if (amount <= 0) return;
          lineItems.push({
            name: `${originalItem.name || "Item"} (Split - P${personIdx + 1})`,
            amount: amount,
            quantity: 1,
            category: originalItem.category || ((result as any).items?.[0] as any)?.category || "Shopping",
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

      alert(`Transaction created successfully! Amount: $${Math.abs(amountValue).toFixed(2)}`);

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
    <div className="min-h-[70vh] w-full bg-[#121212] px-4 pb-12 pt-4 text-white sm:px-6 md:px-10 lg:px-14">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 md:gap-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Receipts</h1>
          <p className="mt-1 text-sm text-white/60 sm:text-base">
            Upload a receipt image or PDF, review extracted details, and create a transaction.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <section className="rounded-2xl border border-white/15 bg-[#151515] p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2 text-sm text-white/70">
              <UploadCloud className="h-4 w-4" />
              Upload receipt
            </div>

            <Label htmlFor="picture" className="mb-2 inline-flex">
              Choose file
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                id="picture"
                type="file"
                onChange={handleFileUpload}
                className="bg-transparent"
                accept="image/*,application/pdf"
              />
              <Button
                onClick={handleReset}
                variant="outline"
                className="w-full border-white/20 bg-transparent text-white hover:bg-white/10 sm:w-auto"
              >
                Reset
              </Button>
            </div>

            <div className="mt-5">
              {loading ? (
                <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-6 text-sm text-white/80">
                  Processing receipt...
                </div>
              ) : error ? (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-6 text-sm text-red-300">
                  {error}
                </div>
              ) : result ? (
                <div className="space-y-4">
                  <BillSplitter
                    key={JSON.stringify(result)}
                    initialReceipt={result}
                    onSplitsChange={setSplitData}
                  />
                  <div className="flex justify-stretch border-t border-white/15 pt-4 sm:justify-end">
                    <Button
                      onClick={handleCreateTransaction}
                      disabled={isCreatingTransaction}
                      className="w-full border border-white/20 bg-[#1d1d1d] text-white hover:bg-[#2a2a2a] sm:w-auto"
                    >
                      {isCreatingTransaction ? "Creating..." : "Create Transaction"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-white/20 bg-black/20 px-4 py-8 text-center text-sm text-white/45">
                  Receipt analysis will appear here after upload.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-white/15 bg-[#151515] p-4 sm:p-6">
            <h2 className="mb-3 text-sm font-medium text-white/70">Preview</h2>
            <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-white/10 bg-black/20">
              {image && previewUrl ? (
                isPdf ? (
                  <iframe
                    src={previewUrl}
                    className="h-[420px] w-full rounded-xl border-0 p-2"
                    title="Receipt PDF"
                  />
                ) : (
                  <Image
                    src={previewUrl}
                    alt="Receipt"
                    width={420}
                    height={560}
                    className="max-h-[60vh] w-full rounded-xl object-contain p-2"
                    unoptimized
                  />
                )
              ) : (
                <div className="px-4 text-center text-sm text-white/45">No receipt uploaded yet.</div>
              )}
            </div>
          </section>
        </div>

        <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
          <DialogContent className="max-h-[85vh] w-[calc(100vw-1.5rem)] max-w-[560px] overflow-y-auto border-white/15 bg-[#121212] text-white">
            <DialogHeader>
              <DialogTitle>Review Transaction Details</DialogTitle>
              <DialogDescription>
                Adjust details before saving this receipt as a transaction.
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

            <DialogFooter className="flex-col-reverse gap-2 pt-2 sm:flex-row">
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
  );
};

export default Page;
