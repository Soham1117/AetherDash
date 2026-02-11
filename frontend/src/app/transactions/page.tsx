"use client";
import { DataTableDemo } from "@/components/ui/DataTable";
import { useDash } from "@/context/DashboardContext";
import { useState, useEffect, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, Sparkles, Loader2, ArrowRight, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
import { useAuth } from "@/context/AuthContext";
import { useAcc } from "@/context/AccountContext";
import { useCategories, Category } from "@/context/CategoryContext";
import { useTran } from "@/context/TransactionContext";
import { TagSelect } from "@/components/finance/tags/tag-select";
import { ImportSheet } from "@/components/finance/transactions/ImportSheet";
import { PayeeAutocomplete } from "@/components/finance/transactions/payee-autocomplete";
import { formatDate } from "@/lib/utils";
import { useConfirm } from "@/hooks/useConfirm";

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
      return (
        <div className="px-4 flex items-center gap-2">
          <span>{row.getValue("description")}</span>
          {transaction.is_transfer && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <ArrowRight className="h-3 w-3" />
              Transfer
            </span>
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
      const amount = parseFloat(row.getValue("amount"));
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
  const [isBulkCategorizing, setIsBulkCategorizing] = useState(false);
  const [isDetectingDuplicates, setIsDetectingDuplicates] = useState(false);
  const [isDetectingTransfers, setIsDetectingTransfers] = useState(false);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [rowSelection, setRowSelection] = useState({});
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

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
            const res = await fetch("http://localhost:8000/transactions/bulk_delete/", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ transaction_ids: selectedIds })
            });

            if (res.ok) {
                setTransactionList(transactionList.filter(t => !selectedIds.includes(t.id)));
                setRowSelection({});
            } else {
                throw new Error("Failed to delete transactions");
            }
        } catch (e) {
            console.error(e);
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
    if (!accessToken) return;

    setIsDetectingTransfers(true);
    try {
      const response = await fetch("http://localhost:8000/transactions/detect_transfers/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Failed to detect transfers");

      const data = await response.json();
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
  const { accounts, spendingList } = useDash();
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
      if (filterDateFrom && transactionDate < new Date(filterDateFrom)) {
        return false;
      }
      if (filterDateTo && transactionDate > new Date(filterDateTo)) {
        return false;
      }

      return true;
    });
  }, [transactionList, filterCategory, filterAccount, filterType, filterTransfer, filterDateFrom, filterDateTo]);

  const handleDelete = async (transaction: Transaction) => {
    openConfirm(
      "Delete Transaction",
      "Are you sure you want to delete this transaction? This action cannot be undone.",
      async () => {
        try {
          const accessToken = tokens?.access || JSON.parse(localStorage.getItem("authTokens") || "{}")?.access;
          const res = await fetch(`http://localhost:8000/transactions/${transaction.id}/`, {
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

  const handleCreateSubmit = async () => {
    console.log(newTransaction);
    if (!newTransaction) return;
    try {
      const response = await fetch("http://localhost:8000/transactions/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens?.access}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newTransaction),
      });

      if (!response.ok) {
        throw new Error("Failed to create transaction");
      }
      // Parse the response to get the newly created budget (with the generated ID)
      const createdTransaction: Transaction = await response.json();

      createdTransaction.account =
        accounts.find(
          (account) => account.id === parseInt(createdTransaction.account)
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
      console.error("Error creating budget:", error);
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
    }
  }, [isEditSheetOpen]);

  const handleEditSubmit = async () => {
    if (!editingTransaction) return;
    try {
      // Convert timestamp to date format (YYYY-MM-DD)
      const dateValue = editingTransaction.timestamp.includes('T') 
        ? editingTransaction.timestamp.split('T')[0]
        : editingTransaction.timestamp;

      const response = await fetch(`http://localhost:8000/transactions/${editingTransaction.id}/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${tokens?.access}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editingTransaction.description,
          category: editingTransaction.category || null,
          amount: editingTransaction.amount,
          date: dateValue,
          tag_ids: editingTransaction.tag_ids,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.error || "Failed to update transaction");
      }

      const updatedTransaction = await response.json();
      
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
              }
            : t
        )
      );

      setIsEditSheetOpen(false);
      setEditingTransaction(null);
    } catch (error) {
      console.error("Error updating transaction:", error);
    }
  };

  const handleAICategorize = async () => {
    if (!editingTransaction) return;

    // Get token from localStorage if not in context
    const storedTokens = localStorage.getItem("authTokens");
    const tokenData = storedTokens ? JSON.parse(storedTokens) : null;
    const accessToken = tokens?.access || tokenData?.access;

    if (!accessToken) {
      return;
    }

    setIsCategorizing(true);
    try {
      const response = await fetch("http://localhost:8000/transactions/categorize_with_ai/", {
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
        throw new Error("Failed to categorize transaction");
      }

      const data = await response.json();
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
        console.log(`Transaction categorized as: ${newCategory}`);
      } else {
        openConfirm(
          "No Category Found",
          "AI couldn't determine a suitable category for this transaction.",
          () => {},
          "OK",
          "default"
        );
      }
    } catch (error) {
      console.error("Error categorizing transaction:", error);
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
    // Find all uncategorized transactions
    const uncategorized = transactionList.filter(
      (t) => !t.category || t.category === "" || t.category === "Uncategorized"
    );

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
      "Categorize Transactions",
      `Use AI to categorize ${uncategorized.length} uncategorized transaction(s)?`,
      async () => {
        // Get token from localStorage if not in context
        const storedTokens = localStorage.getItem("authTokens");
        const tokenData = storedTokens ? JSON.parse(storedTokens) : null;
        const accessToken = tokens?.access || tokenData?.access;

        if (!accessToken) {
          return;
        }

        setIsBulkCategorizing(true);
        try {
          const descriptions = uncategorized.map((t) => t.description || t.name || t.merchant_name || "Transaction");
          const transactionIds = uncategorized.map((t) => t.id);

          console.log("[Bulk Categorize] Sending request with token:", accessToken ? "Token present" : "No token");
          console.log("[Bulk Categorize] Raw input descriptions:", descriptions);

          const response = await fetch("http://localhost:8000/transactions/categorize_with_ai/", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              descriptions: descriptions,
              transaction_ids: transactionIds,
              auto_update: true,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("Categorization error:", errorData, "Status:", response.status);
            if (response.status === 401) {
              return;
            }
            throw new Error(errorData.error || errorData.detail || "Failed to categorize transactions");
          }

          const data = await response.json();
          console.log("[Bulk Categorize] Raw output categories:", data.categories);

          // Update the transaction list with new categories
          const categoryMap = new Map(
            uncategorized.map((t, index) => [t.id, data.categories[index]])
          );

          setTransactionList(
            transactionList.map((t) => {
              if (categoryMap.has(t.id)) {
                return { ...t, category: categoryMap.get(t.id) || t.category };
              }
              return t;
            })
          );

          // Show success feedback
          setIsBulkCategorizing(false);
          openConfirm(
            "Categorization Complete",
            `Successfully categorized ${uncategorized.length} transaction(s) using AI. Your transactions have been updated with their new categories.`,
            () => {},
            "OK",
            "default"
          );
        } catch (error) {
          console.error("Error bulk categorizing transactions:", error);
          setIsBulkCategorizing(false);
          openConfirm(
            "Categorization Failed",
            `Failed to categorize transactions. ${error instanceof Error ? error.message : 'Please try again.'}`,
            () => {},
            "OK",
            "destructive"
          );
        }
      },
      "Start Categorization"
    );
  };

  const handleDetectDuplicates = async () => {
    // Get token from localStorage if not in context
    const storedTokens = localStorage.getItem("authTokens");
    const tokenData = storedTokens ? JSON.parse(storedTokens) : null;
    const accessToken = tokens?.access || tokenData?.access;

    if (!accessToken) {
      return;
    }

    setIsDetectingDuplicates(true);
    try {
      const response = await fetch("http://localhost:8000/transactions/detect_duplicates/", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to detect duplicates");
      }

      const data = await response.json();
      setDuplicates(data.duplicates || []);
      setIsDuplicateModalOpen(true);
    } catch (error) {
      console.error("Error detecting duplicates:", error);
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
      className={`flex flex-col gap-4 min-h-[81vh] w-full bg-[#121212] text-base font-sans pt-4  mb-20 pl-24 pr-12`}
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Transactions</h1>
        <p className="text-white/60 mt-1">
          View and manage all your financial transactions.
        </p>
      </div>

      <div className="flex flex-row gap-4 justify-end items-center">
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
        {Object.keys(rowSelection).length > 0 && (
            <Button
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
            >
                {isBulkDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Delete Selected ({Object.keys(rowSelection).length})
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
            <Button variant="default" size="icon" className="p-4 text-2xl">
              +
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Add a Transaction</SheetTitle>
              <SheetDescription>
                Add a transaction. This will be added to the transaction list.
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 py-4">
              {/* Date Input */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="date" className="text-right">
                  Date
                </Label>
                <Input
                  id="date"
                  type="date"
                  value={newTransaction.timestamp}
                  className="col-span-3"
                  onChange={(e) =>
                    setNewTransaction((prev) => ({
                      ...prev,
                      timestamp: e.target.value,
                    }))
                  }
                />
              </div>

              {/* Description Input */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Payee
                </Label>
                <div className="col-span-3">
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
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">
                  Amount
                </Label>
                <Input
                  id="amount"
                  type="number"
                  value={newTransaction.amount}
                  className="col-span-3"
                  onChange={(e) =>
                    setNewTransaction((prev) => ({
                      ...prev,
                      amount: parseFloat(e.target.value),
                    }))
                  }
                />
              </div>

              {/* Type Combobox */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">
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
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="category" className="text-right">
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
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="account" className="text-right">
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
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="tags" className="text-right">
                  Tags
                </Label>
                <div className="col-span-3">
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

            <SheetFooter>
              <SheetClose asChild>
                <Button type="submit" onClick={handleCreateSubmit}>
                  Save changes
                </Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end border border-white/10 p-4 bg-[#121212] mb-4 rounded-lg shadow-sm">
        <div className="flex flex-col gap-2 min-w-[180px]">
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

        <div className="flex flex-col gap-2 min-w-[180px]">
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

        <div className="flex flex-col gap-2 min-w-[150px]">
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

        <div className="flex flex-col gap-2 min-w-[150px]">
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

        <div className="flex flex-col gap-2 min-w-[140px]">
          <Label className="text-xs text-white/60">From Date</Label>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="bg-[#121212] border border-white/15 text-white px-3 py-2 text-sm hover:bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </div>

        <div className="flex flex-col gap-2 min-w-[140px]">
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

        <div className="ml-auto text-sm text-white/60">
          Showing {filteredTransactions.length} of {transactionList.length} transactions
        </div>
      </div>

      <DataTableDemo
        columns={columns}
        data={filteredTransactions}
        rowSelection={rowSelection}
        setRowSelection={setRowSelection}
      />

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
                    <div key={groupIndex} className="bg-[#121212] border border-white/10 rounded-lg overflow-hidden">
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
                                                          const res = await fetch(`http://localhost:8000/transactions/${t.id}/`, {
                                                              method: "DELETE",
                                                              headers: { Authorization: `Bearer ${accessToken}` }
                                                          });
                                                          if (res.ok) {
                                                              handleIgnoreDuplicate(t.id);
                                                              setTransactionList(prev => prev.filter(item => item.id !== t.id));
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
                  {transferResults.map((match, i) => (
                      <div key={i} className="bg-[#121212] border border-white/10 rounded-lg overflow-hidden">
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
                                        {parseFloat(match.source.amount) > 0 ? '+' : ''}{parseFloat(match.source.amount).toFixed(2)}
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
                                                +{Math.abs(parseFloat(match.destination.amount)).toFixed(2)}
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
                  onClick={() => { setIsTransferResultOpen(false); window.location.reload(); }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                    Done
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Confirm Dialog */}
      <ConfirmDialog />

      {/* Edit Transaction Sheet */}
      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              Edit Transaction
              {editingTransaction?.is_transfer && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <ArrowRight className="h-3 w-3" />
                  Transfer
                </span>
              )}
            </SheetTitle>
            <SheetDescription>
              Update transaction details. Use AI to automatically categorize.
            </SheetDescription>
            {editingTransaction?.is_transfer && (
              <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-blue-500/5 border border-blue-500/20">
                <div className="text-xs text-blue-400">
                  This is an internal transfer and will be excluded from income/expense calculations.
                </div>
              </div>
            )}
          </SheetHeader>
          {editingTransaction && (
            <div className="grid gap-4 py-4">
              {/* Description */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-description" className="text-right">
                  Payee
                </Label>
                <div className="col-span-3">
                  <PayeeAutocomplete
                    value={editingTransaction.description || ""}
                    onChange={(val) =>
                      setEditingTransaction({
                        ...editingTransaction,
                        description: val,
                      })
                    }
                  />
                </div>
              </div>

              {/* Category with AI Button */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-category" className="text-right">
                  Category
                </Label>
                <div className="col-span-3 flex gap-2">
                  <ComboboxCat
                    options={categoryOptions}
                    setCategory={(category) =>
                      setEditingTransaction({
                        ...editingTransaction,
                        category: category,
                      })
                    }
                    value={editingTransaction.category}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleAICategorize}
                    disabled={isCategorizing}
                    title="Use AI to categorize this transaction"
                  >
                    {isCategorizing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Amount */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-amount" className="text-right">
                  Amount
                </Label>
                <Input
                  id="edit-amount"
                  type="number"
                  value={editingTransaction.amount}
                  className="col-span-3"
                  onChange={(e) =>
                    setEditingTransaction({
                      ...editingTransaction,
                      amount: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>

              {/* Date */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-date" className="text-right">
                  Date
                </Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editingTransaction.timestamp.split("T")[0]}
                  className="col-span-3"
                  onChange={(e) =>
                    setEditingTransaction({
                      ...editingTransaction,
                      timestamp: e.target.value,
                    })
                  }
                />
              </div>

              {/* Type */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-type" className="text-right">
                  Type
                </Label>
                <ComboboxType
                  options={typeOptions}
                  setType={(type) =>
                    setEditingTransaction({
                      ...editingTransaction,
                      transaction_type: type,
                    })
                  }
                  value={editingTransaction.transaction_type}
                />
              </div>

              {/* Tags */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-tags" className="text-right">
                  Tags
                </Label>
                <div className="col-span-3">
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
          )}
          <SheetFooter>
            <SheetClose asChild>
              <Button variant="outline" onClick={() => setEditingTransaction(null)}>
                Cancel
              </Button>
            </SheetClose>
            <Button type="submit" onClick={handleEditSubmit}>
              Save changes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Transactions;
