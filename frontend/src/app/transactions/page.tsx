"use client";
import { DataTableDemo } from "@/components/ui/DataTable";
import { useDash } from "@/context/DashboardContext";
import { useState, useEffect, useMemo, ChangeEvent } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, Sparkles, Loader2, ArrowRight, Trash2, AlertTriangle, CheckCircle2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetHeader,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { ComboboxCat } from "./comboBoxCategory";
import { ComboboxType } from "./comboBoxType";
import { ComboboxAcc } from "./comboBoxAcc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";

import { useCategories, Category } from "@/context/CategoryContext";
import { useTran } from "@/context/TransactionContext";
import { TagSelect } from "@/components/finance/tags/tag-select";
import { ImportSheet } from "@/components/finance/transactions/ImportSheet";
import { PayeeAutocomplete } from "@/components/finance/transactions/payee-autocomplete";
import { formatDate } from "@/lib/utils";
import { useConfirm } from "@/hooks/useConfirm";
import Link from "next/link";

export type Transaction = {
  id: number;
  amount: number;
  timestamp: string;
  description: string;
  category: string;
  transaction_type: string;
  account: string;
  tag_ids?: number[];
  tags?: any[];
  is_transfer?: boolean;
  transfer_override?: boolean;
  extracted_items?: Array<{ id?: number; name?: string; quantity?: number; qty?: number; total_price?: number; line_total?: number; price?: number }>;
};

type TransactionItem = {
  id?: number;
  name: string;
  quantity?: number;
  qty?: number;
  price?: number;
  unit_price?: number;
  total_price?: number;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Dev visibility: many flows used to fail silently (no token, 401, empty body). */
const txLog = (message: string, detail?: unknown) => {
  if (detail !== undefined) console.log("[transactions]", message, detail);
  else console.log("[transactions]", message);
};
const txWarnNoToken = (where: string) => {
  console.warn(
    "[transactions]",
    `${where}: no access token — log in or ensure AuthContext / localStorage authTokens has access`
  );
};

const buildColumns = (
  onEdit: (transaction: Transaction) => void,
  onDelete: (transaction: Transaction) => void
): ColumnDef<Transaction>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="rounded-none"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
    accessorFn: (row) => row.id,
  },
  {
    accessorKey: "timestamp",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Date
          <ArrowUpDown />
        </Button>
      );
    },
    cell: ({ row }) => {
      const dateValue = row.getValue("timestamp") as string;
      return (
        <div className="capitalize">
          {formatDate(dateValue, { format: "short" })}
        </div>
      );
    },
  },
  {
    accessorKey: "description",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Description
          <ArrowUpDown />
        </Button>
      );
    },
    cell: ({ row }) => {
      const transaction = row.original;
      const items = transaction.extracted_items || [];
      return (
        <div className="px-4">
          <div className="flex items-center gap-2">
            <span>{row.getValue("description")}</span>
            {transaction.is_transfer && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <ArrowRight className="h-3 w-3" />
                Transfer
              </span>
            )}
          </div>
          {items.length > 0 && (
            <details className="mt-1">
              <summary className="text-[11px] text-white/60 cursor-pointer hover:text-white/80">
                {items.length} item{items.length > 1 ? 's' : ''} in order
              </summary>
              <div className="mt-1 rounded border border-white/10 bg-white/[0.02] p-2 space-y-1">
                {items.slice(0, 8).map((it: any, idx: number) => {
                  const qty = it.quantity ?? it.qty ?? 1;
                  const price = it.total_price ?? it.line_total ?? it.price ?? 0;
                  return (
                    <div key={`${it.id || idx}-${it.name || 'item'}`} className="flex justify-between text-[11px] text-white/80 gap-2">
                      <span className="truncate">{it.name || 'Unnamed item'} × {qty}</span>
                      <span>${Number(price).toFixed(2)}</span>
                    </div>
                  );
                })}
                {items.length > 8 && <div className="text-[10px] text-white/50">+{items.length - 8} more…</div>}
              </div>
            </details>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "amount",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Amount
          <ArrowUpDown />
        </Button>
      );
    },
    cell: ({ row }) => {
      const amount = Number.parseFloat(row.getValue("amount"));
      const transaction = row.original;

      // Format the amount as a dollar amount
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount);

      return (
        <div className={`font-medium px-4 ${transaction.is_transfer ? 'text-white/40' : ''}`}>
          {formatted}
        </div>
      );
    },
  },

  {
    accessorKey: "transaction_type",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Type
          <ArrowUpDown />
        </Button>
      );
    },
    cell: ({ row }) => (
      <div className="px-4">{row.getValue("transaction_type")}</div>
    ),
  },
  {
    accessorKey: "category",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Category
          <ArrowUpDown />
        </Button>
      );
    },
    cell: ({ row }) => (
      <div className="lowercase">{row.getValue("category")}</div>
    ),
  },
  {
    accessorKey: "account",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Account
          <ArrowUpDown />
        </Button>
      );
    },
    cell: ({ row }) => <div className="px-4">{row.getValue("account")}</div>,
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const Transaction = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() =>
                navigator.clipboard.writeText(String(Transaction.id))
              }
            >
              Copy Transaction ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                onEdit(Transaction);
              }}
            >
              Edit Transaction
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-500 focus:bg-red-100/10"
              onClick={() => {
                onDelete(Transaction);
              }}
            >
              Delete Transaction
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    accessorFn: (row) => row.id,
  },
];

const Transactions = () => {
  const { transactionList, setTransactionList } = useDash();
  const { refreshTransactions } = useTran();
  const [newTransaction, setNewTransaction] = useState<Partial<Transaction>>({
    timestamp: new Date().toISOString().split("T")[0],
    description: "",
    amount: 0,
    transaction_type: "",
    category: "",
    account: "",
    tag_ids: [],
  });
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [transactionItems, setTransactionItems] = useState<TransactionItem[]>([]);
  const [itemizationError, setItemizationError] = useState<string | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [isExtractingItems, setIsExtractingItems] = useState(false);
  const [isClearingItems, setIsClearingItems] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isBulkCategorizing, setIsBulkCategorizing] = useState(false);
  const [isDetectingDuplicates, setIsDetectingDuplicates] = useState(false);
  const [isDetectingTransfers, setIsDetectingTransfers] = useState(false);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [rowSelection, setRowSelection] = useState({});
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [editSheetTab, setEditSheetTab] = useState<"details" | "receipt">("details");

  // Transfer Detection State
  const [transferResults, setTransferResults] = useState<any[]>([]);
  const [isTransferResultOpen, setIsTransferResultOpen] = useState(false);

  // Filter State
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterAccount, setFilterAccount] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all"); // all, debit, credit
  const [filterTransfer, setFilterTransfer] = useState<string>("all"); // all, only, exclude
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");

  const { tokens } = useAuth();
  const { openConfirm, ConfirmDialog } = useConfirm();

  const handleBulkDelete = async () => {
    const selectedIds = Object.keys(rowSelection).map(Number);
    if (selectedIds.length === 0) return;

    openConfirm(
      "Delete Transactions",
      `Are you sure you want to delete ${selectedIds.length} transaction(s)? This cannot be undone.`,
      async () => {
        setIsBulkDeleting(true);
        try {
            const accessToken = tokens?.access || JSON.parse(localStorage.getItem("authTokens") || "{}")?.access;
            if (!accessToken) {
              txWarnNoToken("bulkDelete");
              setIsBulkDeleting(false);
              return;
            }
            txLog("bulkDelete request", { count: selectedIds.length, ids: selectedIds });
            const res = await fetch(`${API_URL}/transactions/bulk_delete/`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ transaction_ids: selectedIds })
            });

            if (res.ok) {
                txLog("bulkDelete ok", { count: selectedIds.length });
                setTransactionList(transactionList.filter(t => !selectedIds.includes(t.id)));
                setRowSelection({});
            } else {
                const errBody = await res.json().catch(() => ({}));
                txLog("bulkDelete failed", { status: res.status, body: errBody });
                throw new Error("Failed to delete transactions");
            }
        } catch (e) {
            console.error("[transactions] bulkDelete error", e);
        } finally {
            setIsBulkDeleting(false);
        }
      },
      "Delete",
      "destructive"
    );
  };

  const handleDetectTransfers = async () => {
    const accessToken = tokens?.access || JSON.parse(localStorage.getItem("authTokens") || "{}")?.access;
    if (!accessToken) {
      txWarnNoToken("detectTransfers");
      return;
    }

    setIsDetectingTransfers(true);
    try {
      txLog("detectTransfers POST", `${API_URL}/transactions/detect_transfers/`);
      const response = await fetch(`${API_URL}/transactions/detect_transfers/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        txLog("detectTransfers response not ok", { status: response.status, body });
        throw new Error("Failed to detect transfers");
      }

      const data = await response.json();
      txLog("detectTransfers result", { matches_found: data.matches_found, matches_len: (data.matches || []).length });
      if (data.matches_found > 0) {
        setTransferResults(data.matches || []);
        setIsTransferResultOpen(true);
      } else {
        openConfirm(
          "No Transfers Detected",
          "No matching transfer pairs were found in your transactions.",
          () => {},
          "OK",
          "default"
        );
      }
    } catch (error) {
      console.error("Error detecting transfers:", error);
      openConfirm(
        "Transfer Detection Failed",
        `Failed to detect transfers. ${error instanceof Error ? error.message : 'Please try again.'}`,
        () => {},
        "OK",
        "destructive"
      );
    } finally {
      setIsDetectingTransfers(false);
    }
  };
  const { accounts } = useDash();
  const { categories: allCategories } = useCategories();

  const categoryOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const traverse = (cats: Category[]) => {
      cats.forEach(cat => {
        options.push({ value: cat.name, label: cat.name });
        if (cat.children) traverse(cat.children);
      });
    };
    traverse(allCategories);
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [allCategories]);

  // Filtered transaction list
  const filteredTransactions = useMemo(() => {
    return transactionList.filter((transaction) => {
      // Category filter
      if (filterCategory !== "all" && transaction.category !== filterCategory) {
        return false;
      }

      // Account filter
      if (filterAccount !== "all" && transaction.account !== filterAccount) {
        return false;
      }

      // Type filter
      if (filterType !== "all" && transaction.transaction_type !== filterType) {
        return false;
      }

      // Transfer filter
      if (filterTransfer === "only" && !transaction.is_transfer) {
        return false;
      }
      if (filterTransfer === "exclude" && transaction.is_transfer) {
        return false;
      }

      // Date range filter
      const transactionDate = new Date(transaction.timestamp);
      const isValidDate = !Number.isNaN(transactionDate.getTime());

      if (!isValidDate) {
         if (filterDateFrom || filterDateTo) return false;
      } else {
         if (filterDateFrom && transactionDate < new Date(filterDateFrom)) return false;
         if (filterDateTo && transactionDate > new Date(filterDateTo)) return false;
      }

      return true;
    });
  }, [transactionList, filterCategory, filterAccount, filterType, filterTransfer, filterDateFrom, filterDateTo]);

  useEffect(() => {
    const allFilteredOut =
      transactionList.length > 0 && filteredTransactions.length === 0;
    txLog("Transactions page — list vs filters", {
      transactionListLen: transactionList.length,
      filteredLen: filteredTransactions.length,
      filters: {
        category: filterCategory,
        account: filterAccount,
        type: filterType,
        transfer: filterTransfer,
        dateFrom: filterDateFrom || null,
        dateTo: filterDateTo || null,
      },
      ...(allFilteredOut
        ? {
            warning:
              "API returned rows but filters hide all of them — click Clear Filters",
          }
        : {}),
    });
  }, [
    transactionList.length,
    filteredTransactions.length,
    filterCategory,
    filterAccount,
    filterType,
    filterTransfer,
    filterDateFrom,
    filterDateTo,
  ]);

  const selectedCount = Object.keys(rowSelection).length;

  const isTransactionSelected = (id: number) => Boolean((rowSelection as Record<string, boolean>)[String(id)]);

  const toggleTransactionSelection = (id: number, checked: boolean) => {
    setRowSelection((prev) => {
      const next = { ...(prev as Record<string, boolean>) };
      if (checked) next[String(id)] = true;
      else delete next[String(id)];
      return next;
    });
  };

  const toggleAllVisibleSelections = (checked: boolean) => {
    setRowSelection((prev) => {
      const next = { ...(prev as Record<string, boolean>) };
      filteredTransactions.forEach((tx) => {
        const key = String(tx.id);
        if (checked) next[key] = true;
        else delete next[key];
      });
      return next;
    });
  };

  const handleDelete = async (transaction: Transaction) => {
    openConfirm(
      "Delete Transaction",
      "Are you sure you want to delete this transaction? This action cannot be undone.",
      async () => {
        try {
          const accessToken = tokens?.access || JSON.parse(localStorage.getItem("authTokens") || "{}")?.access;
          if (!accessToken) {
            txWarnNoToken(`delete transaction id=${transaction.id}`);
            return;
          }
          txLog("delete transaction", { id: transaction.id });
          const res = await fetch(`${API_URL}/transactions/${transaction.id}/`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` }
          });

          if (res.ok) {
            setTransactionList(transactionList.filter((t) => t.id !== transaction.id));
          } else {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.detail || "Failed to delete transaction");
          }
        } catch (error) {
          console.error("Error deleting transaction:", error);
        }
      },
      "Delete",
      "destructive"
    );
  };

  const columns = useMemo(
    () =>
      buildColumns(
        (transaction) => {
          setEditingTransaction(transaction);
          setIsEditSheetOpen(true);
        },
        handleDelete
      ),
    [setEditingTransaction, setIsEditSheetOpen, handleDelete]
  );

  const getAccessToken = () => tokens?.access || JSON.parse(localStorage.getItem("authTokens") || "{}")?.access;
  const normalizeTxId = (rawId: unknown): number | null => {
    if (typeof rawId === 'number' && Number.isFinite(rawId)) return rawId;
    const m = String(rawId ?? '').match(/\d+/);
    return m ? Number(m[0]) : null;
  };

  const resolveEditingTxId = (tx: Partial<Transaction> | null): number | null => {
    if (!tx) return null;

    const candidate = normalizeTxId(tx.id);
    const idExists = candidate != null && transactionList.some((t) => Number(t.id) === candidate);
    if (idExists) return candidate;

    // Fallback: resolve by signature when UI row id is synthetic (e.g., trans_42)
    const match = transactionList.find((t) => {
      const sameDesc = (t.description || '').trim().toLowerCase() === (tx.description || '').trim().toLowerCase();
      const sameAmt = Number(t.amount) === Number(tx.amount);
      const d1 = String(t.timestamp || '').slice(0, 10);
      const d2 = String(tx.timestamp || '').slice(0, 10);
      const sameDate = d1 && d2 && d1 === d2;
      return sameDesc && sameAmt && sameDate;
    });

    return match ? Number(match.id) : candidate;
  };

  const normalizeItemsFromPayload = (payload: any): TransactionItem[] => {
    const rawItems = payload?.items || payload?.line_items || payload?.results || [];
    if (!Array.isArray(rawItems)) return [];
    return rawItems.map((item: any) => ({
      id: item.id,
      name: item.name || item.item_name || "Unnamed item",
      quantity: typeof item.quantity === "number" ? item.quantity : item.qty,
      qty: item.qty,
      price: item.price,
      unit_price: item.unit_price,
      total_price: item.total_price,
    }));
  };

  const fetchTransactionItems = async (transactionId: number) => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      txWarnNoToken(`fetchTransactionItems txId=${transactionId}`);
      return;
    }

    setIsLoadingItems(true);
    setItemizationError(null);
    try {
      const response = await fetch(`${API_URL}/transactions/${transactionId}/extracted_items/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.status === 404) {
        txLog("fetchTransactionItems 404 (no line items)", { transactionId });
        setTransactionItems([]);
        return;
      }

      if (!response.ok) {
        txLog("fetchTransactionItems failed", { transactionId, status: response.status });
        throw new Error("Failed to load extracted items");
      }

      const data = await response.json();
      const normalized = normalizeItemsFromPayload(data);
      txLog("fetchTransactionItems ok", { transactionId, itemCount: normalized.length });
      setTransactionItems(normalized);
    } catch (error) {
      setItemizationError(error instanceof Error ? error.message : "Failed to load extracted items");
    } finally {
      setIsLoadingItems(false);
    }
  };

  const handleReceiptFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setReceiptFile(file);
  };

  const handleUploadReceipt = async () => {
    if (!editingTransaction || !receiptFile) return;

    const txId = resolveEditingTxId(editingTransaction);
    if (!txId) {
      setItemizationError("Invalid transaction id for upload");
      return;
    }

    const accessToken = getAccessToken();
    if (!accessToken) {
      txWarnNoToken(`uploadReceipt txId=${txId}`);
      return;
    }

    setIsUploadingReceipt(true);
    setItemizationError(null);

    try {
      const formData = new FormData();
      formData.append("file", receiptFile);

      txLog("uploadReceipt POST", { txId, file: receiptFile.name, size: receiptFile.size });
      const response = await fetch(`${API_URL}/transactions/${txId}/upload_evidence/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to upload receipt");
      }

      setReceiptFile(null);
      txLog("uploadReceipt ok", { txId });
      await fetchTransactionItems(txId);
    } catch (error) {
      txLog("uploadReceipt error", error instanceof Error ? error.message : error);
      setItemizationError(error instanceof Error ? error.message : "Failed to upload receipt");
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const handleExtractItems = async () => {
    if (!editingTransaction) return;

    const txId = resolveEditingTxId(editingTransaction);
    if (!txId) {
      setItemizationError("Invalid transaction id for extraction");
      return;
    }

    const accessToken = getAccessToken();
    if (!accessToken) {
      txWarnNoToken(`extractItems txId=${txId}`);
      return;
    }

    setIsExtractingItems(true);
    setItemizationError(null);

    try {
      txLog("extractItems POST", { txId });
      const response = await fetch(`${API_URL}/transactions/${txId}/extract_items/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        txLog("extractItems failed", { txId, status: response.status, errorData });
        throw new Error(errorData.detail || "Failed to extract items");
      }

      const data = await response.json().catch(() => ({}));
      const normalized = normalizeItemsFromPayload(data);
      txLog("extractItems response", { txId, normalizedCount: normalized.length });
      if (normalized.length > 0) {
        setTransactionItems(normalized);
      } else {
        await fetchTransactionItems(txId);
      }
    } catch (error) {
      txLog("extractItems error", error instanceof Error ? error.message : error);
      setItemizationError(error instanceof Error ? error.message : "Failed to extract items");
    } finally {
      setIsExtractingItems(false);
    }
  };

  const handleClearExtractedItems = async () => {
    if (!editingTransaction) return;
    const txId = resolveEditingTxId(editingTransaction);
    if (!txId) {
      setItemizationError("Invalid transaction id for clear items");
      return;
    }
    const accessToken = getAccessToken();
    if (!accessToken) {
      txWarnNoToken(`clearExtractedItems txId=${txId}`);
      return;
    }

    setIsClearingItems(true);
    setItemizationError(null);

    try {
      txLog("clearExtractedItems POST", { txId });
      const response = await fetch(`${API_URL}/transactions/${txId}/clear_extracted_items/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clear_evidence: false }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        txLog("clearExtractedItems failed", { txId, status: response.status, errorData });
        throw new Error(errorData.detail || "Failed to clear extracted items");
      }

      txLog("clearExtractedItems ok", { txId });
      setTransactionItems([]);
    } catch (error) {
      txLog("clearExtractedItems error", error instanceof Error ? error.message : error);
      setItemizationError(error instanceof Error ? error.message : "Failed to clear extracted items");
    } finally {
      setIsClearingItems(false);
    }
  };

  const handleCreateSubmit = async () => {
    txLog("createTransaction submit", newTransaction);
    if (!newTransaction) return;
    const accessToken = tokens?.access || JSON.parse(localStorage.getItem("authTokens") || "{}")?.access;
    if (!accessToken) {
      txWarnNoToken("createTransaction");
      return;
    }
    try {
      const response = await fetch(`${API_URL}/transactions/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newTransaction),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        txLog("createTransaction failed", { status: response.status, body: errBody });
        throw new Error("Failed to create transaction");
      }
      // Parse the response to get the newly created budget (with the generated ID)
      const createdTransaction: Transaction = await response.json();
      txLog("createTransaction ok", { id: createdTransaction.id });

      createdTransaction.account =
        accounts.find(
          (account) => account.id === Number.parseInt(createdTransaction.account)
        )?.account_name || "Unknown";

      // Add the newly created budget to the local state
      setTransactionList([...transactionList, createdTransaction]);

      // Reset the newBudget state
      setNewTransaction({
        timestamp: new Date().toISOString().split("T")[0],
        description: "",
        amount: 0,
        transaction_type: "",
        category: "",
        account: "",
      });
    } catch (error) {
      console.error("[transactions] createTransaction error", error);
    }
  };

  const typeOptions = [
    { value: "credit", label: "Credit" },
    { value: "debit", label: "Debit" },
  ];

  const accountOptions = accounts.map((account) => ({
    value: account.id.toString(),
    label: account.account_name,
  }));

  // Update editing transaction when sheet opens
  useEffect(() => {
    if (isEditSheetOpen && editingTransaction) {
      // Ensure timestamp is in correct format for date input
      const dateValue = editingTransaction.timestamp.includes('T') 
        ? editingTransaction.timestamp.split('T')[0]
        : editingTransaction.timestamp;
      setEditingTransaction({
        ...editingTransaction,
        timestamp: dateValue,
      });
      setReceiptFile(null);
      const txId = resolveEditingTxId(editingTransaction);
      if (txId) fetchTransactionItems(txId);
    }

    if (!isEditSheetOpen) {
      setTransactionItems([]);
      setItemizationError(null);
      setReceiptFile(null);
    }
  }, [isEditSheetOpen, editingTransaction?.id]);

  useEffect(() => {
    if (isEditSheetOpen) setEditSheetTab("details");
  }, [isEditSheetOpen]);

  const handleEditSubmit = async () => {
    if (!editingTransaction) return;
    const accessToken = tokens?.access || JSON.parse(localStorage.getItem("authTokens") || "{}")?.access;
    if (!accessToken) {
      txWarnNoToken(`editSubmit id=${editingTransaction.id}`);
      return;
    }
    try {
      // Convert timestamp to date format (YYYY-MM-DD)
      const dateValue = editingTransaction.timestamp.includes('T') 
        ? editingTransaction.timestamp.split('T')[0]
        : editingTransaction.timestamp;

      txLog("editSubmit PATCH", {
        id: editingTransaction.id,
        api: `${API_URL}/transactions/${editingTransaction.id}/`,
      });
      const response = await fetch(`${API_URL}/transactions/${editingTransaction.id}/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editingTransaction.description,
          category: editingTransaction.category || null,
          amount: editingTransaction.amount,
          date: dateValue,
          tag_ids: editingTransaction.tag_ids,
          is_transfer: Boolean(editingTransaction.is_transfer),
          transfer_override: Boolean(editingTransaction.transfer_override),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        txLog("editSubmit failed", { status: response.status, body: errorData });
        throw new Error(errorData.detail || errorData.error || "Failed to update transaction");
      }

      const updatedTransaction = await response.json();
      txLog("editSubmit ok", { id: updatedTransaction.id, category: updatedTransaction.category });
      
      // Find the account name for the updated transaction
      const accountName = accounts.find(
        (account) => account.id === updatedTransaction.account
      )?.account_name || "Unknown";
      
      // Update the transaction list
      setTransactionList(
        transactionList.map((t) =>
          t.id === updatedTransaction.id
            ? {
                ...t,
                description: updatedTransaction.name || t.description,
                category: updatedTransaction.category || t.category || "Uncategorized",
                amount: updatedTransaction.amount,
                timestamp: updatedTransaction.date || t.timestamp,
                account: accountName,
                tags: updatedTransaction.tags,
                is_transfer: updatedTransaction.is_transfer ?? t.is_transfer,
                transfer_override: updatedTransaction.transfer_override ?? t.transfer_override,
              }
            : t
        )
      );

      setIsEditSheetOpen(false);
      setEditingTransaction(null);
    } catch (error) {
      console.error("[transactions] editSubmit error", error);
    }
  };

  const handleAICategorize = async () => {
    if (!editingTransaction) {
      txLog("aiCategorize skipped: no editingTransaction");
      return;
    }

    // Get token from localStorage if not in context
    const storedTokens = localStorage.getItem("authTokens");
    const tokenData = storedTokens ? JSON.parse(storedTokens) : null;
    const accessToken = tokens?.access || tokenData?.access;

    if (!accessToken) {
      txWarnNoToken(`aiCategorize txId=${editingTransaction.id}`);
      return;
    }

    setIsCategorizing(true);
    try {
      txLog("aiCategorize POST", {
        url: `${API_URL}/transactions/categorize_with_ai/`,
        transaction_id: editingTransaction.id,
        auto_update: true,
      });
      const response = await fetch(`${API_URL}/transactions/categorize_with_ai/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          descriptions: [editingTransaction.description],
          transaction_ids: [editingTransaction.id],
          auto_update: true, // Automatically save to database
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        txLog("aiCategorize HTTP error", { status: response.status, body: errBody });
        throw new Error("Failed to categorize transaction");
      }

      const data = await response.json();
      txLog("aiCategorize response", {
        categories: data.categories,
        keys: data && typeof data === "object" ? Object.keys(data) : [],
      });
      if (data.categories && data.categories.length > 0) {
        const newCategory = data.categories[0];
        // Update local state
        setEditingTransaction({
          ...editingTransaction,
          category: newCategory,
        });

        // Also update the transaction list immediately
        setTransactionList(
          transactionList.map((t) =>
            t.id === editingTransaction.id
              ? { ...t, category: newCategory }
              : t
          )
        );

        // Show success message
        txLog("aiCategorize applied category", newCategory);
      } else {
        txLog("aiCategorize: no categories in response", data);
        openConfirm(
          "No Category Found",
          "AI couldn't determine a suitable category for this transaction.",
          () => {},
          "OK",
          "default"
        );
      }
    } catch (error) {
      console.error("[transactions] aiCategorize error", error);
      openConfirm(
        "Categorization Failed",
        `Failed to categorize transaction. ${error instanceof Error ? error.message : 'Please try again.'}`,
        () => {},
        "OK",
        "destructive"
      );
    } finally {
      setIsCategorizing(false);
    }
  };

  const handleBulkCategorize = async () => {
    txLog("bulkCategorize clicked", { listSize: transactionList.length });
    const uncategorized = transactionList.filter(
      (t) => !t.category || t.category === "" || t.category === "Uncategorized"
    );
    txLog("bulkCategorize uncategorized count", uncategorized.length);

    if (uncategorized.length === 0) {
      openConfirm(
        "No Uncategorized Transactions",
        "All your transactions already have categories assigned.",
        () => {},
        "OK",
        "default"
      );
      return;
    }

    openConfirm(
      "AI categorization",
      `Analyze ${uncategorized.length} uncategorized transaction(s)? Nothing is saved until you confirm the preview.`,
      async () => {
        const storedTokens = localStorage.getItem("authTokens");
        const tokenData = storedTokens ? JSON.parse(storedTokens) : null;
        const accessToken = tokens?.access || tokenData?.access;

        if (!accessToken) {
          txWarnNoToken("bulkCategorize (after Analyze confirm)");
          return;
        }

        setIsBulkCategorizing(true);
        try {
          const descriptions = uncategorized.map((t) => t.description || "Transaction");
          const transactionIds = uncategorized.map((t) => t.id);

          txLog("bulkCategorize preview POST", {
            url: `${API_URL}/transactions/categorize_with_ai/`,
            count: transactionIds.length,
            preview: true,
          });
          const response = await fetch(`${API_URL}/transactions/categorize_with_ai/`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              descriptions,
              transaction_ids: transactionIds,
              preview: true,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            txLog("bulkCategorize preview HTTP error", { status: response.status, body: errorData });
            if (response.status === 401) {
              txWarnNoToken("bulkCategorize preview 401");
              setIsBulkCategorizing(false);
              return;
            }
            throw new Error(errorData.error || errorData.detail || "Failed to analyze transactions");
          }

          const data = await response.json();
          const proposals = (data.proposals || []) as Array<{
            transaction_id: number | null;
            description: string;
            proposed_category: string;
            source: string;
            confidence?: number;
          }>;

          txLog("bulkCategorize preview response", {
            proposalCount: (data.proposals || []).length,
            responseKeys: data && typeof data === "object" ? Object.keys(data) : [],
          });

          const counts: Record<string, number> = {};
          for (const p of proposals) {
            const s = p.source || "unknown";
            counts[s] = (counts[s] || 0) + 1;
          }
          const summary = Object.keys(counts).length
            ? Object.entries(counts)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ")
            : "none";

          const sample = proposals
            .slice(0, 6)
            .map(
              (p) =>
                `• ${(p.description || "").slice(0, 52)}${(p.description || "").length > 52 ? "…" : ""} → ${p.proposed_category} (${p.source})`
            )
            .join("\n");

          setIsBulkCategorizing(false);

          openConfirm(
            "Apply categories?",
            `Proposed for ${proposals.length} transaction(s).\nSources: ${summary}\n\n${sample}${proposals.length > 6 ? "\n…" : ""}\n\nSave all to your ledger?`,
            async () => {
              setIsBulkCategorizing(true);
              try {
                const applications = proposals
                  .filter((p) => p.transaction_id != null)
                  .map((p) => ({
                    transaction_id: p.transaction_id as number,
                    category: p.proposed_category,
                  }));

                txLog("bulkCategorize apply POST", {
                  url: `${API_URL}/transactions/apply_category_suggestions/`,
                  applicationCount: applications.length,
                });
                const applyRes = await fetch(`${API_URL}/transactions/apply_category_suggestions/`, {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ applications }),
                });

                if (!applyRes.ok) {
                  const err = await applyRes.json().catch(() => ({}));
                  txLog("bulkCategorize apply failed", { status: applyRes.status, body: err });
                  throw new Error(err.error || err.detail || "Failed to apply categories");
                }

                const applyData = await applyRes.json();
                txLog("bulkCategorize apply ok", applyData);
                const categoryMap = new Map(
                  proposals
                    .filter((p) => p.transaction_id != null)
                    .map((p) => [p.transaction_id as number, p.proposed_category])
                );

                setTransactionList(
                  transactionList.map((t) => {
                    if (categoryMap.has(t.id)) {
                      return { ...t, category: categoryMap.get(t.id) || t.category };
                    }
                    return t;
                  })
                );

                setIsBulkCategorizing(false);
                openConfirm(
                  "Categorization complete",
                  `Updated ${applyData.updated_count ?? 0} transaction(s).`,
                  () => {},
                  "OK",
                  "default"
                );
              } catch (applyErr) {
                console.error("[transactions] bulkCategorize apply error", applyErr);
                setIsBulkCategorizing(false);
                openConfirm(
                  "Apply failed",
                  applyErr instanceof Error ? applyErr.message : "Could not save categories.",
                  () => {},
                  "OK",
                  "destructive"
                );
              }
            },
            "Apply all",
            "default"
          );
        } catch (error) {
          console.error("[transactions] bulkCategorize preview error", error);
          setIsBulkCategorizing(false);
          openConfirm(
            "Categorization failed",
            `Failed to analyze transactions. ${error instanceof Error ? error.message : "Please try again."}`,
            () => {},
            "OK",
            "destructive"
          );
        }
      },
      "Analyze",
      "default"
    );
  };

  const handleDetectDuplicates = async () => {
    // Get token from localStorage if not in context
    const storedTokens = localStorage.getItem("authTokens");
    const tokenData = storedTokens ? JSON.parse(storedTokens) : null;
    const accessToken = tokens?.access || tokenData?.access;

    if (!accessToken) {
      txWarnNoToken("detectDuplicates");
      return;
    }

    setIsDetectingDuplicates(true);
    try {
      txLog("detectDuplicates GET", `${API_URL}/transactions/detect_duplicates/`);
      const response = await fetch(`${API_URL}/transactions/detect_duplicates/`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        txLog("detectDuplicates failed", { status: response.status, body });
        throw new Error("Failed to detect duplicates");
      }

      const data = await response.json();
      const dups = data.duplicates || [];
      txLog("detectDuplicates ok", { groupCount: dups.length });
      setDuplicates(dups);
      setIsDuplicateModalOpen(true);
    } catch (error) {
      console.error("[transactions] detectDuplicates error", error);
    } finally {
      setIsDetectingDuplicates(false);
    }
  };

  const handleIgnoreDuplicate = (id: number) => {
    // Remove the group that contains this transaction or just remove the transaction from its group
    setDuplicates((prev: any[]) => {
      const updated = prev.map(group => group.filter((t: any) => t.id !== id))
                          .filter(group => group.length > 1); // Only keep groups with at least 2 potential duplicates
      return updated;
    });
  };

  return (
    <div
      className={`flex flex-col gap-4 min-h-[81vh] w-full bg-[#121212] text-base font-sans pt-3 sm:pt-4 mb-20 px-3 sm:px-6 lg:pl-24 lg:pr-12`}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Transactions</h1>
          <p className="text-white/60 mt-1">View and manage all your financial transactions.</p>
        </div>

        <div className="grid grid-cols-1 min-[520px]:grid-cols-2 lg:flex gap-2 sm:gap-3 items-stretch lg:items-center">
        <Link href="/transactions/items" className="w-full sm:w-auto">
          <Button
            variant="outline"
            className="bg-[#1c1c1c] border-white/15 text-white hover:bg-[#2b2b2b]"
          >
            Item Search
          </Button>
        </Link>
        <Button
          variant="outline"
          onClick={handleDetectTransfers}
          disabled={isDetectingTransfers}
          className="bg-[#1c1c1c] border-white/15 text-white hover:bg-[#2b2b2b]"
        >
          {isDetectingTransfers ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Linking...
            </>
          ) : (
            "Detect Transfers"
          )}
        </Button>
        <Button
          variant="outline"
          onClick={handleDetectDuplicates}
          disabled={isDetectingDuplicates}
          className="bg-[#1c1c1c] border-white/15 text-white hover:bg-[#2b2b2b]"
        >
          {isDetectingDuplicates ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scanning...
            </>
          ) : (
            "Find Duplicates"
          )}
        </Button>
        {selectedCount > 0 && (
            <Button
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
            >
                {isBulkDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Delete Selected ({selectedCount})
            </Button>
        )}
        <ImportSheet onImportComplete={refreshTransactions} />
        <Button
          variant="outline"
          onClick={handleBulkCategorize}
          disabled={isBulkCategorizing}
          className="bg-[#1c1c1c] border-white/15 text-white hover:bg-[#2b2b2b]"
        >
          {isBulkCategorizing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Categorizing...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Categorize All Uncategorized
            </>
          )}
        </Button>
        <Sheet>
          <SheetTrigger>
            <Button variant="default" size="icon" className="p-4 text-2xl w-full sm:w-auto">
              +
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[100vw] sm:w-[98vw] sm:max-w-4xl overflow-y-auto px-3 sm:px-6">
            <SheetHeader>
              <SheetTitle>Add a Transaction</SheetTitle>
              <SheetDescription>
                Add a transaction. This will be added to the transaction list.
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 py-4">
              {/* Date Input */}
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label htmlFor="date" className="sm:text-right">
                  Date
                </Label>
                <Input
                  id="date"
                  type="date"
                  value={newTransaction.timestamp}
                  className="col-span-1 sm:col-span-3"
                  onChange={(e) =>
                    setNewTransaction((prev) => ({
                      ...prev,
                      timestamp: e.target.value,
                    }))
                  }
                />
              </div>

              {/* Description Input */}
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label htmlFor="description" className="sm:text-right">
                  Payee
                </Label>
                <div className="col-span-1 sm:col-span-3">
                  <PayeeAutocomplete
                    value={newTransaction.description || ""}
                    onChange={(val) =>
                      setNewTransaction((prev) => ({
                        ...prev,
                        description: val,
                      }))
                    }
                  />
                </div>
              </div>

              {/* Amount Input */}
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label htmlFor="amount" className="sm:text-right">
                  Amount
                </Label>
                <Input
                  id="amount"
                  type="number"
                  value={newTransaction.amount}
                  className="col-span-1 sm:col-span-3"
                  onChange={(e) =>
                    setNewTransaction((prev) => ({
                      ...prev,
                      amount: Number.parseFloat(e.target.value),
                    }))
                  }
                />
              </div>

              {/* Type Combobox */}
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label htmlFor="type" className="sm:text-right">
                  Type
                </Label>
                <ComboboxType
                  options={typeOptions}
                  setType={(type) =>
                    setNewTransaction((prev) => ({
                      ...prev,
                      transaction_type: type,
                    }))
                  }
                />
              </div>

              {/* Category Combobox */}
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label htmlFor="category" className="sm:text-right">
                  Category
                </Label>
                <ComboboxCat
                  options={categoryOptions}
                  setCategory={(category) =>
                    setNewTransaction((prev) => ({
                      ...prev,
                      category: category,
                    }))
                  }
                />
              </div>

              {/* Account Combobox */}
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label htmlFor="account" className="sm:text-right">
                  Account
                </Label>
                <ComboboxAcc
                  options={accountOptions}
                  setAccountNumber={(accountNumber) =>
                    setNewTransaction((prev) => ({
                      ...prev,
                      account: accountNumber.toString(),
                    }))
                  }
                />
              </div>

              {/* Tag Select */}
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label htmlFor="tags" className="sm:text-right">
                  Tags
                </Label>
                <div className="col-span-1 sm:col-span-3">
                  <TagSelect
                    value={newTransaction.tag_ids || []}
                    onValueChange={(tags) =>
                      setNewTransaction((prev) => ({
                        ...prev,
                        tag_ids: tags,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <SheetFooter className="flex-col-reverse gap-2 sm:flex-row">
              <SheetClose asChild>
                <Button type="submit" onClick={handleCreateSubmit}>
                  Save changes
                </Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
      </div>
      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 items-end border border-white/10 p-3 sm:p-4 bg-[#121212] mb-4 rounded-lg shadow-sm">
        <div className="flex flex-col gap-2 w-full sm:min-w-[180px]">
          <Label className="text-xs text-white/60">Category</Label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-[#121212] border border-white/15 text-white px-3 py-2 text-sm hover:bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-white/20"
          >
            <option value="all">All Categories</option>
            {categoryOptions.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2 w-full sm:min-w-[180px]">
          <Label className="text-xs text-white/60">Account</Label>
          <select
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
            className="bg-[#121212] border border-white/15 text-white px-3 py-2 text-sm hover:bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-white/20"
          >
            <option value="all">All Accounts</option>
            {accounts.map((acc) => (
              <option key={acc.account_name} value={acc.account_name}>
                {acc.account_name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2 w-full sm:min-w-[150px]">
          <Label className="text-xs text-white/60">Type</Label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-[#121212] border border-white/15 text-white px-3 py-2 text-sm hover:bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-white/20"
          >
            <option value="all">All Types</option>
            <option value="debit">Expense</option>
            <option value="credit">Income</option>
          </select>
        </div>

        <div className="flex flex-col gap-2 w-full sm:min-w-[150px]">
          <Label className="text-xs text-white/60">Transfers</Label>
          <select
            value={filterTransfer}
            onChange={(e) => setFilterTransfer(e.target.value)}
            className="bg-[#121212] border border-white/15 text-white px-3 py-2 text-sm hover:bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-white/20"
          >
            <option value="all">All</option>
            <option value="exclude">Exclude Transfers</option>
            <option value="only">Only Transfers</option>
          </select>
        </div>

        <div className="flex flex-col gap-2 w-full sm:min-w-[140px]">
          <Label className="text-xs text-white/60">From Date</Label>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="bg-[#121212] border border-white/15 text-white px-3 py-2 text-sm hover:bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>

        <div className="flex flex-col gap-2 w-full sm:min-w-[140px]">
          <Label className="text-xs text-white/60">To Date</Label>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="bg-[#121212] border border-white/15 text-white px-3 py-2 text-sm hover:bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setFilterCategory("all");
            setFilterAccount("all");
            setFilterType("all");
            setFilterTransfer("all");
            setFilterDateFrom("");
            setFilterDateTo("");
          }}
          className="border border-white/15 text-white/60 hover:text-white hover:bg-white/5"
        >
          Clear Filters
        </Button>

        <div className="text-sm text-white/60 xl:ml-auto">
          Showing {filteredTransactions.length} of {transactionList.length} transactions
        </div>
      </div>

      <div className="sm:hidden space-y-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <label className="inline-flex items-center gap-2 text-xs text-white/70">
            <Checkbox
              checked={filteredTransactions.length > 0 && filteredTransactions.every((tx) => isTransactionSelected(tx.id))}
              onCheckedChange={(value) => toggleAllVisibleSelections(Boolean(value))}
              aria-label="Select all visible transactions"
            />
            Select all visible
          </label>
          <span className="text-xs text-white/50">{selectedCount} selected</span>
        </div>
        {filteredTransactions.length === 0 ? (
          <div className="border border-white/10 rounded-lg p-4 text-sm text-white/60">No transactions found for current filters.</div>
        ) : (
          filteredTransactions.map((transaction) => {
            const amount = Number(transaction.amount || 0);
            const formattedAmount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
            const items = transaction.extracted_items || [];

            return (
              <div key={transaction.id} className="border border-white/10 rounded-lg bg-[#151515] p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <Checkbox
                      checked={isTransactionSelected(transaction.id)}
                      onCheckedChange={(value) => toggleTransactionSelection(transaction.id, Boolean(value))}
                      aria-label={`Select transaction ${transaction.id}`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{transaction.description || "No description"}</p>
                      <p className="text-xs text-white/60">{formatDate(transaction.timestamp, { format: "short" })}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${transaction.is_transfer ? "text-white/50" : "text-white"}`}>{formattedAmount}</p>
                    {transaction.is_transfer && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <ArrowRight className="h-3 w-3" />
                        Transfer
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-white/70">
                  <div className="truncate"><span className="text-white/50">Type:</span> {transaction.transaction_type || "-"}</div>
                  <div className="truncate text-right"><span className="text-white/50">Category:</span> {transaction.category || "-"}</div>
                  <div className="col-span-2 truncate"><span className="text-white/50">Account:</span> {transaction.account || "-"}</div>
                </div>

                {items.length > 0 && (
                  <details className="rounded border border-white/10 bg-white/[0.02] px-2 py-1.5">
                    <summary className="text-xs text-white/70 cursor-pointer">{items.length} item{items.length > 1 ? "s" : ""} in receipt</summary>
                    <div className="mt-2 space-y-1">
                      {items.slice(0, 4).map((it: any, idx: number) => {
                        const qty = it.quantity ?? it.qty ?? 1;
                        const price = it.total_price ?? it.line_total ?? it.price ?? 0;
                        return (
                          <div key={`${it.id || idx}-${it.name || "item"}`} className="flex justify-between text-xs text-white/80 gap-2">
                            <span className="truncate">{it.name || "Unnamed item"} × {qty}</span>
                            <span>${Number(price).toFixed(2)}</span>
                          </div>
                        );
                      })}
                      {items.length > 4 && <div className="text-[11px] text-white/50">+{items.length - 4} more…</div>}
                    </div>
                  </details>
                )}

                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => { setEditingTransaction(transaction); setIsEditSheetOpen(true); }}>
                    Edit
                  </Button>
                  <Button type="button" variant="destructive" size="sm" className="flex-1" onClick={() => handleDelete(transaction)}>
                    Delete
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="hidden sm:block">
        <DataTableDemo
          columns={columns}
          data={filteredTransactions}
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
        />
      </div>

      {/* Duplicate Detection Modal */}
      <Dialog open={isDuplicateModalOpen} onOpenChange={setIsDuplicateModalOpen}>
        <DialogContent className="sm:max-w-[900px] bg-[#0a0a0a] border-white/15 text-white max-h-[85vh] flex flex-col">
          <DialogHeader className="pb-4 border-b border-white/10">
            <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                </div>
                Potential Duplicates
            </DialogTitle>
            <DialogDescription className="text-white/60 mt-2">
              {duplicates.length === 0
                ? "No potential duplicates found"
                : `Found ${duplicates.length} group(s) of similar transactions. Review and delete duplicates to clean up your ledger.`}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4 -mr-4">
            <div className="py-4">
              {duplicates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 border border-dashed border-white/10 rounded-lg bg-white/5">
                  <CheckCircle2 className="h-12 w-12 text-green-500/50 mb-3" />
                  <p className="text-white/60 text-sm">All transactions are unique</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {duplicates.map((group, groupIndex) => (
                    <div key={group[0].id} className="bg-[#121212] border border-white/10 rounded-lg overflow-hidden">
                      <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 px-4 py-2.5 border-b border-white/10 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white/90 uppercase tracking-wider">Group {groupIndex + 1}</span>
                            <span className="text-xs text-white/40">•</span>
                            <span className="text-xs text-yellow-400">{group.length} similar transactions</span>
                          </div>
                      </div>
                      <div className="divide-y divide-white/5">
                          {group.map((t: any, idx: number) => (
                              <div key={t.id} className="flex items-center justify-between p-4 hover:bg-white/5 transition-all duration-150 group/item">
                                  <div className="flex items-center gap-4 flex-1">
                                      <div className="flex flex-col items-center justify-center min-w-[48px]">
                                        <span className="text-xs text-white/30 font-mono">#{idx + 1}</span>
                                        <span className="text-[10px] text-white/20 font-mono">ID: {t.id}</span>
                                      </div>
                                      <div className="h-10 w-px bg-white/10" />
                                      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                              <span className="font-medium text-sm text-white truncate">{t.name || t.description}</span>
                                              <span className="text-xs text-white/50 px-2 py-0.5 rounded-md bg-white/10 border border-white/10 shrink-0">
                                                {t.account}
                                              </span>
                                          </div>
                                          <div className="flex items-center gap-2 text-xs text-white/40">
                                            <span className="font-mono">{new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                            {t.category && (
                                              <>
                                                <span>•</span>
                                                <span className="text-white/30">{t.category}</span>
                                              </>
                                            )}
                                          </div>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-3 ml-4">
                                      <span className={`font-mono font-bold text-lg min-w-[100px] text-right ${
                                        t.amount < 0 ? 'text-white' : 'text-green-400'
                                      }`}>
                                          ${Math.abs(t.amount).toFixed(2)}
                                      </span>
                                      <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-9 w-9 text-red-500/40 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover/item:opacity-100 transition-all"
                                          onClick={() => {
                                              openConfirm(
                                                  "Delete Duplicate",
                                                  `Are you sure you want to delete this transaction? This will permanently remove "${t.name || t.description}" from your ledger.`,
                                                  async () => {
                                                      try {
                                                          const accessToken = tokens?.access || JSON.parse(localStorage.getItem("authTokens") || "{}")?.access;
                                                          const res = await fetch(`${API_URL}/transactions/${t.id}/`, {
                                                              method: "DELETE",
                                                              headers: { Authorization: `Bearer ${accessToken}` }
                                                          });
                                                          if (res.ok) {
                                                              handleIgnoreDuplicate(t.id);
                                                              setTransactionList(transactionList.filter(item => item.id !== t.id));
                                                          } else {
                                                              throw new Error("Failed to delete");
                                                          }
                                                      } catch (e) {
                                                          console.error("Delete failed", e);
                                                      }
                                                  },
                                                  "Delete",
                                                  "destructive"
                                              );
                                          }}
                                      >
                                          <Trash2 className="h-4 w-4" />
                                      </Button>
                                  </div>
                              </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="pt-4 border-t border-white/10">
            <Button
              variant="outline"
              onClick={() => setIsDuplicateModalOpen(false)}
              className="bg-transparent border-white/15 text-white hover:bg-white/5"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Detection Result Modal */}
      <Dialog open={isTransferResultOpen} onOpenChange={setIsTransferResultOpen}>
        <DialogContent className="sm:max-w-[800px] bg-[#0a0a0a] border-white/15 text-white max-h-[85vh] flex flex-col">
            <DialogHeader className="pb-4 border-b border-white/10">
                <DialogTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Sparkles className="h-5 w-5 text-blue-400" />
                    </div>
                    Transfers Detected & Linked
                </DialogTitle>
                <DialogDescription className="text-white/60 mt-2">
                    Successfully linked {transferResults.length} pairs of transactions as transfers. These transactions have been marked as transfers and exclude from spending/income calculations.
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 pr-4 -mr-4">
              <div className="space-y-4 py-4">
                  {transferResults.map((match) => (
                      <div key={match.source.id} className="bg-[#121212] border border-white/10 rounded-lg overflow-hidden">
                          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 px-4 py-2.5 border-b border-white/10">
                              <div className="flex items-center gap-2 text-sm">
                                  <span className="text-white/90 font-medium">{match.source.account}</span>
                                  {match.destination ? (
                                    <>
                                        <ArrowRight className="h-4 w-4 text-blue-400" />
                                        <span className="text-white/90 font-medium">{match.destination.account}</span>
                                    </>
                                  ) : (
                                    <>
                                        <ArrowRight className="h-4 w-4 text-white/20" />
                                        <span className="text-white/40 italic">Waiting for match</span>
                                    </>
                                  )}
                                  <span className="ml-auto text-xs text-white/40">{new Date(match.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              </div>
                          </div>

                          <div className="p-4 space-y-4">
                              {/* Source Transaction */}
                              <div className="flex items-center gap-4">
                                  <div className="flex flex-col items-center justify-center min-w-[80px] p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                                      {match.type?.includes("cc_payment") ? (
                                          <span className="text-[10px] text-red-400 uppercase font-semibold tracking-wider">Payment</span>
                                      ) : (
                                          <span className="text-[10px] text-red-400 uppercase font-semibold tracking-wider">Debit</span>
                                      )}
                                      <span className="text-xs text-white/50 mt-0.5">From</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <p className="font-medium text-white truncate">{match.source.name}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-white/40 px-2 py-0.5 rounded bg-white/10">{match.source.account}</span>
                                        <span className="text-xs text-white/30">•</span>
                                        <span className="text-xs text-white/40">ID: {match.source.id}</span>
                                      </div>
                                  </div>
                                  <div className="text-right">
                                      <p className="font-mono font-bold text-lg text-red-400">
                                        {Number.parseFloat(match.source.amount) > 0 ? '+' : ''}{Number.parseFloat(match.source.amount).toFixed(2)}
                                      </p>
                                      <p className="text-[10px] text-white/30 mt-0.5">Source</p>
                                  </div>
                              </div>

                              {/* Connection Line */}
                              {match.destination && (
                                <>
                                    <div className="flex justify-center -my-2 relative z-0">
                                        <div className="h-8 w-px border-l border-dashed border-white/20" />
                                    </div>

                                    {/* Destination Transaction */}
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col items-center justify-center min-w-[80px] p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                                            <span className="text-[10px] text-green-400 uppercase font-semibold tracking-wider">Credit</span>
                                            <span className="text-xs text-white/50 mt-0.5">To</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-white truncate">{match.destination.name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs text-white/40 px-2 py-0.5 rounded bg-white/10">{match.destination.account}</span>
                                                <span className="text-xs text-white/30">•</span>
                                                <span className="text-xs text-white/40">ID: {match.destination.id}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-mono font-bold text-lg text-green-400">
                                                +{Math.abs(Number.parseFloat(match.destination.amount)).toFixed(2)}
                                            </p>
                                            <p className="text-[10px] text-white/30 mt-0.5">Destination</p>
                                        </div>
                                    </div>
                                </>
                              )}

                              {/* Status Badge */}
                              <div className="pt-3 border-t border-white/5">
                                  <div className="flex items-center gap-2 text-xs">
                                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                      <span className="text-white/60">Both transactions marked as transfers and excluded from spending calculations</span>
                                  </div>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
            </ScrollArea>
            <DialogFooter className="pt-4 border-t border-white/10">
                <Button
                  onClick={() => { setIsTransferResultOpen(false); globalThis.location.reload(); }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                    Done
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Confirm Dialog */}
      <ConfirmDialog />

      {/* Edit Transaction — right sheet (aligned with Add Transaction form layout) */}
      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent className="flex h-full max-h-[100dvh] w-full flex-col gap-0 overflow-hidden border-l border-white/10 bg-[#121212] p-0 sm:max-w-[min(100vw,680px)]">
          {editingTransaction ? (
            <>
              <Tabs
                value={editSheetTab}
                onValueChange={(v) => setEditSheetTab(v as "details" | "receipt")}
                className="flex min-h-0 flex-1 flex-col"
              >
                <SheetHeader className="shrink-0 space-y-0 border-b border-white/10 px-6 pb-6 pt-7 text-left sm:px-8">
                  <SheetTitle className="sr-only">
                    Edit transaction {editingTransaction.description || editingTransaction.id}
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    Update payee, amount, category, and receipt line items.
                  </SheetDescription>
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">Edit transaction</p>
                  <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-4xl font-semibold tracking-tight text-white tabular-nums">
                        {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                          Number(editingTransaction.amount) || 0
                        )}
                      </p>
                      <p className="text-[15px] font-medium leading-relaxed text-white/90 break-words">
                        {editingTransaction.description || "No payee"}
                      </p>
                      <p className="text-sm text-white/50">
                        {formatDate(editingTransaction.timestamp, { format: "short" })}
                        {editingTransaction.account ? ` · ${editingTransaction.account}` : ""}
                      </p>
                    </div>
                    {editingTransaction.is_transfer && (
                      <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-300">
                        <ArrowRight className="h-3.5 w-3.5" />
                        Transfer
                      </span>
                    )}
                  </div>
                  {editingTransaction.is_transfer && (
                    <p className="mt-5 rounded-lg border border-blue-500/20 bg-blue-500/[0.07] px-4 py-3 text-sm leading-relaxed text-blue-200/90">
                      Excluded from income and expense totals as an internal transfer.
                    </p>
                  )}
                  <TabsList className="mt-7 grid h-12 w-full grid-cols-2 rounded-xl border border-white/15 bg-[#1c1c1c] p-1.5">
                    <TabsTrigger
                      value="details"
                      className="rounded-md text-sm data-[state=active]:bg-[#2b2b2b] data-[state=active]:text-white data-[state=inactive]:text-white/55"
                    >
                      Details
                    </TabsTrigger>
                    <TabsTrigger
                      value="receipt"
                      className="inline-flex items-center justify-center gap-2 rounded-md text-sm data-[state=active]:bg-[#2b2b2b] data-[state=active]:text-white data-[state=inactive]:text-white/55"
                    >
                      <Receipt className="h-4 w-4 opacity-80" />
                      Receipt
                    </TabsTrigger>
                  </TabsList>
                </SheetHeader>

                <ScrollArea className="min-h-0 flex-1">
                  <TabsContent
                    value="details"
                    className="m-0 space-y-6 px-6 pb-12 pt-8 focus-visible:outline-none sm:px-8"
                  >
                    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)] sm:p-6">
                      <div className="mb-6 flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/40">Transaction</p>
                          <p className="mt-2 text-sm text-white/50">Core details that define this transaction.</p>
                        </div>
                      </div>
                      <div className="grid gap-6">
                        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-4 sm:items-center sm:gap-5">
                          <Label htmlFor="edit-description" className="sm:text-right text-white/70">
                            Payee
                          </Label>
                          <div className="sm:col-span-3">
                            <PayeeAutocomplete
                              value={editingTransaction.description || ""}
                              onChange={(val) =>
                                setEditingTransaction({
                                  ...editingTransaction,
                                  description: val,
                                })
                              }
                              className="min-h-11 border-white/15 bg-[#121212] text-left"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-4 sm:items-center sm:gap-5">
                          <Label htmlFor="edit-amount" className="sm:text-right text-white/70">
                            Amount
                          </Label>
                          <Input
                            id="edit-amount"
                            type="number"
                            value={editingTransaction.amount}
                            className="col-span-1 sm:col-span-3"
                            onChange={(e) =>
                              setEditingTransaction({
                                ...editingTransaction,
                                amount: Number.parseFloat(e.target.value) || 0,
                              })
                            }
                          />
                        </div>

                        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-4 sm:items-center sm:gap-5">
                          <Label htmlFor="edit-date" className="sm:text-right text-white/70">
                            Date
                          </Label>
                          <Input
                            id="edit-date"
                            type="date"
                            value={editingTransaction.timestamp.split("T")[0]}
                            className="col-span-1 sm:col-span-3"
                            onChange={(e) =>
                              setEditingTransaction({
                                ...editingTransaction,
                                timestamp: e.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-4 sm:items-center sm:gap-5">
                          <Label htmlFor="edit-type" className="sm:text-right text-white/70">
                            Type
                          </Label>
                          <div className="sm:col-span-3 w-full min-w-0">
                            <ComboboxType
                              options={typeOptions}
                              setType={(type) =>
                                setEditingTransaction({
                                  ...editingTransaction,
                                  transaction_type: type,
                                })
                              }
                              value={editingTransaction.transaction_type}
                              matchTriggerWidth
                            />
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.20)] sm:p-6">
                      <p className="mb-6 text-xs font-medium uppercase tracking-[0.12em] text-white/45">Classification</p>
                      <div className="grid gap-5">
                        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-4 sm:items-center sm:gap-5">
                          <Label htmlFor="edit-category" className="sm:text-right text-white/70">
                            Category
                          </Label>
                          <div className="flex flex-col gap-3 sm:col-span-3 sm:flex-row sm:items-stretch">
                            <div className="min-w-0 flex-1">
                              <ComboboxCat
                                options={categoryOptions}
                                setCategory={(category) =>
                                  setEditingTransaction({
                                    ...editingTransaction,
                                    category: category,
                                  })
                                }
                                value={editingTransaction.category}
                                matchTriggerWidth
                              />
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-11 shrink-0 border-white/15 bg-[#1c1c1c] px-4 text-white hover:bg-[#2b2b2b] sm:w-11 sm:px-0"
                              onClick={handleAICategorize}
                              disabled={isCategorizing}
                              title="Suggest category with AI"
                            >
                              {isCategorizing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Sparkles className="h-4 w-4" />
                              )}
                              <span className="ml-2 sm:sr-only">AI</span>
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-4 sm:items-start sm:gap-4">
                          <Label htmlFor="edit-tags" className="sm:pt-2 sm:text-right text-white/80">
                            Tags
                          </Label>
                          <div className="sm:col-span-3">
                            <TagSelect
                              value={editingTransaction.tag_ids || editingTransaction.tags?.map((t: any) => t.id) || []}
                              onValueChange={(tags) =>
                                setEditingTransaction({
                                  ...editingTransaction,
                                  tag_ids: tags,
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.20)] sm:p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-white">Transfer</p>
                          <p className="mt-1 text-sm text-white/50">Manual override beats auto-detection.</p>
                        </div>
                        <Button
                          type="button"
                          size="default"
                          variant={editingTransaction.is_transfer ? "default" : "outline"}
                          className={
                            editingTransaction.is_transfer
                              ? "w-full shrink-0 bg-blue-600 hover:bg-blue-700 sm:w-auto"
                              : "w-full border-white/15 bg-[#1c1c1c] text-white hover:bg-[#2b2b2b] sm:w-auto"
                          }
                          onClick={() =>
                            setEditingTransaction({
                              ...editingTransaction,
                              is_transfer: !editingTransaction.is_transfer,
                              transfer_override: true,
                            })
                          }
                        >
                          {editingTransaction.is_transfer ? "Marked as transfer" : "Mark as transfer"}
                        </Button>
                      </div>
                    </section>
                  </TabsContent>

                  <TabsContent
                    value="receipt"
                    className="m-0 space-y-6 px-6 pb-12 pt-8 focus-visible:outline-none sm:px-8"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">Receipt itemization</p>
                      <p className="mt-1 text-xs text-white/45">Upload a receipt or extract line items from evidence.</p>
                    </div>

                    <div className="space-y-4 rounded-lg border border-white/10 bg-[#121212] p-5 sm:p-6">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={handleReceiptFileChange}
                          className="h-11 cursor-pointer border-white/12 bg-[#121212] text-sm file:mr-2 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-xs file:text-white"
                        />
                        <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-11 flex-1 border-white/15 bg-white/[0.04] text-white"
                            onClick={handleUploadReceipt}
                            disabled={isUploadingReceipt || !receiptFile}
                          >
                            {isUploadingReceipt ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Uploading…
                              </>
                            ) : (
                              "Upload"
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-11 flex-1 border-white/15 bg-white/[0.04] text-white"
                            onClick={handleExtractItems}
                            disabled={isExtractingItems}
                          >
                            {isExtractingItems ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Extracting…
                              </>
                            ) : (
                              "Extract items"
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            className="h-11 flex-1"
                            onClick={handleClearExtractedItems}
                            disabled={isClearingItems || transactionItems.length === 0}
                          >
                            {isClearingItems ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Clearing…
                              </>
                            ) : (
                              "Clear"
                            )}
                          </Button>
                        </div>
                      </div>

                      {itemizationError && (
                        <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                          {itemizationError}
                        </div>
                      )}

                      {isLoadingItems ? (
                        <div className="flex items-center gap-2 text-xs text-white/50">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading line items…
                        </div>
                      ) : transactionItems.length > 0 ? (
                        <div className="overflow-hidden rounded-xl border border-white/10">
                          <div className="grid grid-cols-12 gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-white/45">
                            <span className="col-span-6">Item</span>
                            <span className="col-span-3 text-right">Qty</span>
                            <span className="col-span-3 text-right">Price</span>
                          </div>
                          <div className="max-h-60 divide-y divide-white/10 overflow-auto">
                            {transactionItems.map((item, idx) => {
                              const quantity = item.quantity ?? item.qty ?? 1;
                              const price = item.total_price ?? item.price ?? item.unit_price ?? 0;
                              return (
                                <div
                                  key={`${item.id || idx}-${item.name}`}
                                  className="grid grid-cols-12 gap-2 px-3 py-2.5 text-sm"
                                >
                                  <span className="col-span-6 truncate text-white/90">{item.name || "Unnamed item"}</span>
                                  <span className="col-span-3 text-right tabular-nums text-white/70">{quantity}</span>
                                  <span className="col-span-3 text-right tabular-nums text-white/90">
                                    ${Number(price).toFixed(2)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-white/45">No line items yet.</p>
                      )}
                    </div>
                  </TabsContent>
                </ScrollArea>
              </Tabs>

              <div className="shrink-0 border-t border-white/10 bg-[#121212]/95 px-6 py-5 backdrop-blur-md sm:px-8">
                <SheetFooter className="flex-col-reverse gap-3 sm:flex-row sm:justify-stretch sm:space-x-0 sm:gap-3">
                  <SheetClose asChild>
                    <Button
                      variant="outline"
                      className="h-11 w-full border-white/15 bg-[#1c1c1c] text-white hover:bg-[#2b2b2b]"
                      onClick={() => setEditingTransaction(null)}
                    >
                      Cancel
                    </Button>
                  </SheetClose>
                  <Button
                    type="button"
                    className="h-11 w-full bg-white text-neutral-950 hover:bg-white/90"
                    onClick={handleEditSubmit}
                  >
                    Save changes
                  </Button>
                </SheetFooter>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Transactions;
