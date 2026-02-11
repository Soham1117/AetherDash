"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetFooter, 
  SheetHeader, 
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { useDash } from "@/context/DashboardContext";
import { useConfirm } from "@/hooks/useConfirm";
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Table as TableIcon,
  Pencil,
  X,
  Eye
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BankStatement {
    id: number;
    original_filename: string;
    status: 'pending' | 'processing' | 'review' | 'completed' | 'failed';
    error_message?: string;
    upload_date: string;
    transactions?: any[];
    target_account?: number | null;
}

export function ImportSheet({ onImportComplete }: { onImportComplete?: () => void }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [activeStatementId, setActiveStatementId] = useState<number | null>(null);
  const [fetchingTransactions, setFetchingTransactions] = useState(false);

  // Transaction Editing State
  const [previewTransactions, setPreviewTransactions] = useState<any[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeStatement, setActiveStatement] = useState<BankStatement | null>(null);
  const [reviewAccountId, setReviewAccountId] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);
  const hasCompletedImports = useRef<boolean>(false);

  const { tokens } = useAuth();
  const { accounts } = useDash();
  const { openConfirm, ConfirmDialog } = useConfirm();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
      setError(null);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0 || !tokens?.access) return;
    setLoading(true);
    setError(null);
    
    const formData = new FormData();
    files.forEach(file => {
        formData.append("files", file); // Use 'files' key for multiple
    });
    if (accountId) formData.append("account_id", accountId);

    try {
      const res = await fetch("http://localhost:8000/import/upload/", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.access}` },
        body: formData,
      });
      const data = await res.json();
      
      if (res.ok) {
        console.log("[ImportSheet] Upload success, received statements:", data.length);
        // Data is list of created statements
        setStatements(prev => [...data, ...prev]); // Add new ones to top
        setFiles([]); // Clear upload queue
        startPolling();
      } else {
        setError(data.error || "Upload failed");
      }
    } catch (e) {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  const startPolling = () => {
    if (pollInterval.current) return; // Already polling
    
    pollInterval.current = setInterval(async () => {
        try {
            // Fetch list of recent statements
            const res = await fetch("http://localhost:8000/import/", {
                headers: { Authorization: `Bearer ${tokens?.access}` },
            });
            const data = await res.json();
            if (Array.isArray(data)) {
                console.log("[ImportSheet] Poll data:", data);
                setStatements(data);
                
                const anyProcessing = data.some(s => ['pending', 'processing'].includes(s.status));
                console.log("[ImportSheet] Any processing?", anyProcessing);
                
                if (!anyProcessing) {
                    clearInterval(pollInterval.current!);
                    pollInterval.current = null;
                }
            }
        } catch (e) {
            console.error(e);
        }
    }, 2000);
  };

  // Fetch transactions when entering review mode
  useEffect(() => {
    if (activeStatementId && tokens?.access) {
        console.log("[ImportSheet] Fetching transactions for Statement ID:", activeStatementId);
        const fetchTransactions = async () => {
            setFetchingTransactions(true);
            try {
                const res = await fetch(`http://localhost:8000/import/${activeStatementId}/`, {
                    headers: { Authorization: `Bearer ${tokens.access}` },
                });
                const data = await res.json();
                console.log("[ImportSheet] Received transactions:", data.transactions?.length);
                setActiveStatement(data);
                setPreviewTransactions(data.transactions || []);
                // Set review account if target_account exists
                if (data.target_account) {
                    setReviewAccountId(data.target_account.toString());
                } else {
                    setReviewAccountId("");
                }
            } catch (e) {
                console.error("[ImportSheet] Error fetching transactions:", e);
            } finally {
                setFetchingTransactions(false);
            }
        };
        fetchTransactions();
    }
  }, [activeStatementId, tokens]);

  useEffect(() => {
    // Initial fetch of history
    if (open && tokens?.access) {
        // Reset the flag when opening
        hasCompletedImports.current = false;
        startPolling();
    }
    return () => {
        if (pollInterval.current) clearInterval(pollInterval.current);
        pollInterval.current = null;
    };
  }, [open, tokens]);

  const handleConfirm = async () => {
    if (!activeStatementId || !tokens?.access) return;

    // Validate account selection
    if (!reviewAccountId) {
      setError("Please select an account before confirming import");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const selectedIds = previewTransactions
        .filter(t => t.selected_for_import)
        .map(t => t.id);

      const res = await fetch(`http://localhost:8000/import/${activeStatementId}/confirm/`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${tokens.access}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
          transaction_ids: selectedIds,
          account_id: parseInt(reviewAccountId)
        }),
      });

      if (res.ok) {
        // Mark that we've completed an import successfully
        hasCompletedImports.current = true;
        // Refresh list to show completed
        startPolling();
        setActiveStatementId(null); // Go back to list
        setError(null);
      } else {
        const data = await res.json();
        setError(data.error || "Import failed");
      }
    } catch (e) {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = async (id: number, current: boolean) => {
    // Optimistic update
    setPreviewTransactions(prev => prev.map(t => 
        t.id === id ? { ...t, selected_for_import: !current } : t
    ));
    
    // Background update
    if (activeStatementId) {
        try {
            await fetch(`http://localhost:8000/import/${activeStatementId}/update_selection/`, {
                method: "PATCH",
                headers: { 
                    Authorization: `Bearer ${tokens?.access}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ 
                    transactions: [{ id, selected: !current }] 
                })
            });
        } catch (e) {
            console.error(e);
        }
    }
  };

  const handleSaveEdit = async () => {
    if (!editingTransaction || !activeStatementId || !tokens?.access) return;

    try {
      const res = await fetch(`http://localhost:8000/import/${activeStatementId}/transaction/${editingTransaction.id}/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${tokens.access}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: editingTransaction.date,
          description: editingTransaction.description,
          amount: parseFloat(editingTransaction.amount),
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setPreviewTransactions(prev => prev.map(t => t.id === updated.id ? updated : t));
        setEditingTransaction(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteStatement = async (statementId: number) => {
    if (!tokens?.access) return;

    openConfirm(
      "Delete Statement",
      "Delete this statement? This will remove the statement and all its imported transactions.",
      async () => {
        try {
          const res = await fetch(`http://localhost:8000/import/${statementId}/`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${tokens.access}`,
            },
          });

          if (res.ok) {
            // Remove from local state
            setStatements(prev => prev.filter(s => s.id !== statementId));
            console.log(`[ImportSheet] Deleted statement ${statementId}`);
          }
        } catch (e) {
          console.error(e);
        }
      },
      "Delete",
      "destructive"
    );
  };

  const reset = () => {
    // If any imports were completed, trigger refresh
    if (hasCompletedImports.current && onImportComplete) {
      console.log('[ImportSheet] Triggering transaction refresh on close');
      onImportComplete();
    }

    // Reset state
    setFiles([]);
    setActiveStatementId(null);
    setActiveStatement(null);
    setPreviewTransactions([]);
    setReviewAccountId("");
    setError(null);
    hasCompletedImports.current = false;
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Helper to render status badge
  const renderStatus = (s: BankStatement) => {
    switch (s.status) {
        case 'processing': 
        case 'pending':
            return <span className="flex items-center text-yellow-400 text-xs"><Loader2 className="h-3 w-3 animate-spin mr-1"/> Processing</span>;
        case 'review':
            return <span className="flex items-center text-blue-400 text-xs font-bold">Needs Review</span>;
        case 'completed':
            return <span className="flex items-center text-green-400 text-xs">Completed</span>;
        case 'failed':
            return <span className="flex items-center text-red-400 text-xs"><AlertCircle className="h-3 w-3 mr-1"/> Failed</span>;
        default: return null;
    }
  };

  return (
    <Sheet open={open} onOpenChange={(val) => { setOpen(val); if(!val) reset(); }}>
      <SheetTrigger asChild>
        <Button variant="outline" className="bg-[#1c1c1c] border-white/15 text-white hover:bg-[#2b2b2b]">
          <Upload className="mr-2 h-4 w-4" /> Import Statements
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-xl bg-[#121212] text-white border-white/15 w-full sm:w-[540px] flex flex-col">
        <SheetHeader className="px-1">
          <SheetTitle className="text-white">Import Bank Statements</SheetTitle>
          <SheetDescription>
            Upload one or more PDF statements.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 py-6 overflow-y-auto">
          
          {/* Main Upload / List View */}
          {!activeStatementId && (
            <div className="space-y-6 px-1">
                {/* File Upload Area */}
                <div className="space-y-3">
                    <Label>New Upload</Label>
                    <div className="grid gap-2">
                        <Select value={accountId} onValueChange={setAccountId}>
                        <SelectTrigger className="bg-transparent border-white/15">
                            <SelectValue placeholder="Select account (optional)" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#121212] border-white/15 text-white">
                            {accounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id.toString()}>{acc.account_name}</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>

                        <div 
                            className="border-2 border-dashed border-white/10 rounded-lg p-6 text-center hover:bg-white/5 transition-colors cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileChange} 
                                className="hidden" 
                                accept=".csv,.pdf,.png,.jpg,.jpeg"
                                multiple 
                            />
                            <div className="flex flex-col items-center">
                                <Upload className="h-8 w-8 text-white/20 mb-2" />
                                <p className="text-sm font-medium">Click to select files</p>
                                <p className="text-xs text-white/40">PDF, CSV, Images</p>
                            </div>
                        </div>

                        {/* Staged Files List */}
                        {files.length > 0 && (
                            <div className="space-y-2">
                                {files.map((f, i) => (
                                    <div key={i} className="flex items-center justify-between bg-white/5 p-2 rounded text-sm">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <FileText className="h-4 w-4 text-blue-400 shrink-0" />
                                            <span className="truncate">{f.name}</span>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => removeFile(i)} className="h-6 w-6 p-0 hover:bg-white/10">
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                                <Button 
                                    onClick={handleUpload} 
                                    disabled={loading} 
                                    className="w-full bg-blue-600 hover:bg-blue-700 mt-2"
                                >
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Upload {files.length} Files
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Processing/History List */}
                <div className="space-y-3">
                    <Label>Recent Statements</Label>
                    <ScrollArea className="h-[300px] border border-white/10 rounded-lg p-2">
                        {statements.length === 0 ? (
                            <div className="text-center text-white/30 py-8 text-sm">No recent uploads</div>
                        ) : (
                            <div className="space-y-2 pr-2">
                                {statements.map(stmt => (
                                    <div 
                                        key={stmt.id} 
                                        className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 hover:border-white/20 transition-colors"
                                    >
                                        <div className="flex flex-col overflow-hidden mr-3 min-w-0 flex-1">
                                            <span className="text-sm font-medium truncate" title={stmt.original_filename}>
                                                {stmt.original_filename}
                                            </span>
                                            <div className="flex items-center gap-2 mt-1">
                                                {renderStatus(stmt)}
                                                <span className="text-[10px] text-white/30 shrink-0">
                                                    {new Date(stmt.upload_date).toLocaleDateString()}
                                                </span>
                                            </div>
                                            {stmt.error_message && (
                                                <span className="text-[10px] text-red-400 mt-1 block" title={stmt.error_message}>
                                                    {stmt.error_message.length > 60 ? stmt.error_message.substring(0, 60) + '...' : stmt.error_message}
                                                </span>
                                            )}
                                        </div>
                                        
                                        <div className="flex items-center gap-2 shrink-0">
                                            {stmt.status === 'review' && (
                                                <Button
                                                    size="sm"
                                                    className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                                                    onClick={() => {
                                                        console.log("Opening review for", stmt.id);
                                                        setActiveStatementId(stmt.id);
                                                    }}
                                                >
                                                    Review Transactions
                                                </Button>
                                            )}
                                            {stmt.status === 'completed' && (
                                                <CheckCircle2 className="h-4 w-4 text-green-500/50" />
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 hover:bg-red-500/10 hover:text-red-400 text-white/40"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteStatement(stmt.id);
                                                }}
                                                title="Delete statement"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </div>
          )}

          {/* Review Mode */}
          {activeStatementId && (
            <div className="flex flex-col space-y-4 px-1 h-full">
                <div className="flex items-center justify-between shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => setActiveStatementId(null)} className="-ml-2">
                        ← Back to List
                    </Button>
                    <div className="flex items-center gap-2">
                         <span className="text-xs text-white/40">
                            {previewTransactions.length} found
                        </span>
                    </div>
                </div>

                {/* Account Selection */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                    <Label className="text-xs text-white/60 mb-2 block">Import to Account</Label>
                    <Select value={reviewAccountId} onValueChange={setReviewAccountId}>
                        <SelectTrigger className="bg-transparent border-white/15 text-white">
                            <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#121212] border-white/15 text-white">
                            {accounts.map(acc => (
                                <SelectItem key={acc.id} value={acc.id.toString()}>
                                    {acc.account_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {!reviewAccountId && (
                        <p className="text-xs text-yellow-400 mt-1">⚠ Please select an account to import transactions</p>
                    )}
                </div>

                <div className="flex-1 border border-white/10 rounded-lg overflow-hidden relative flex flex-col min-h-[400px]">
                    {fetchingTransactions ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-[#121212]/80 z-20">
                            <div className="text-center">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
                                <p className="text-sm text-white/60">Loading transactions...</p>
                            </div>
                        </div>
                    ) : null}
                    
                    {!fetchingTransactions && previewTransactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-white/40 p-6 text-center">
                            <FileText className="h-8 w-8 mb-2 opacity-50" />
                            <p>No transactions found.</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-auto">
                            <Table>
                            <TableHeader className="bg-[#181818] sticky top-0 z-10 shadow-sm">
                                <TableRow className="border-white/10 hover:bg-transparent">
                                <TableHead className="w-[30px]"></TableHead>
                                <TableHead className="py-2 h-auto text-[10px] text-white uppercase">Date</TableHead>
                                <TableHead className="py-2 h-auto text-[10px] text-white uppercase">Description</TableHead>
                                <TableHead className="py-2 h-auto text-[10px] text-white uppercase text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {previewTransactions.map((row) => (
                                <TableRow key={row.id} className={`border-white/10 hover:bg-white/5 ${row.is_duplicate ? 'opacity-50' : ''}`}>
                                    <TableCell className="py-2">
                                        <Checkbox 
                                            checked={row.selected_for_import}
                                            onCheckedChange={() => toggleSelection(row.id, row.selected_for_import)}
                                        />
                                    </TableCell>
                                    <TableCell className="py-2 text-[11px] font-mono whitespace-nowrap">{row.date}</TableCell>
                                    <TableCell className="py-2 text-[11px]">
                                        <div className="flex items-center gap-2 group max-w-[200px]">
                                            <span className="truncate">{row.description}</span>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity p-0"
                                                onClick={() => setEditingTransaction({...row})}
                                            >
                                                <Pencil className="h-3 w-3 text-blue-400" />
                                            </Button>
                                        </div>
                                        {row.is_duplicate && <span className="text-[9px] text-yellow-500 bg-yellow-500/10 px-1 rounded inline-block mt-0.5">Duplicate</span>}
                                    </TableCell>
                                    <TableCell className={`py-2 text-[11px] text-right font-bold ${parseFloat(row.amount) < 0 ? 'text-white' : 'text-green-400'}`}>
                                    ${parseFloat(row.amount).toFixed(2)}
                                    </TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                            </Table>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
                        {error}
                    </div>
                )}

                <div className="mt-4 flex justify-end gap-2 shrink-0">
                    <Button onClick={() => setActiveStatementId(null)} variant="ghost">Cancel</Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={loading || !reviewAccountId || previewTransactions.filter(t => t.selected_for_import).length === 0}
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Confirm Import ({previewTransactions.filter(t => t.selected_for_import).length})
                    </Button>
                </div>
            </div>
          )}
        </div>

        {/* Edit Dialog - Kept same as before */}
        <Dialog open={!!editingTransaction} onOpenChange={(open) => !open && setEditingTransaction(null)}>
            <DialogContent className="bg-[#121212] border-white/15 text-white">
                <DialogHeader>
                    <DialogTitle>Edit Transaction</DialogTitle>
                </DialogHeader>
                {editingTransaction && (
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Date</Label>
                            <Input 
                                type="date" 
                                value={editingTransaction.date} 
                                onChange={e => setEditingTransaction({...editingTransaction, date: e.target.value})}
                                className="bg-transparent border-white/15"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Description</Label>
                            <Input 
                                value={editingTransaction.description} 
                                onChange={e => setEditingTransaction({...editingTransaction, description: e.target.value})}
                                className="bg-transparent border-white/15"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Amount</Label>
                            <Input 
                                type="number" 
                                value={editingTransaction.amount} 
                                onChange={e => setEditingTransaction({...editingTransaction, amount: e.target.value})}
                                className="bg-transparent border-white/15"
                            />
                        </div>
                    </div>
                )}
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setEditingTransaction(null)}>Cancel</Button>
                    <Button onClick={handleSaveEdit} className="bg-blue-600 hover:bg-blue-700">Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* Custom Confirm Dialog */}
        <ConfirmDialog />
      </SheetContent>
    </Sheet>
  );
}
