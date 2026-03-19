"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, PackageSearch } from "lucide-react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

type ItemSearchResult = {
  id?: number;
  item_name?: string;
  name?: string;
  quantity?: number;
  qty?: number;
  price?: number;
  total_price?: number;
  line_total?: number;
  unit_price?: number;
  transaction_id?: number;
  transaction?: {
    id?: number;
    date?: string;
    timestamp?: string;
    description?: string;
    merchant?: string;
    amount?: number;
  };
  transaction_date?: string;
  transaction_timestamp?: string;
  transaction_merchant?: string;
  transaction_description?: string;
  transaction_amount?: number;
};

type GroupedResult = {
  transaction_id: number;
  date?: string;
  merchant?: string;
  amount?: number;
  items: ItemSearchResult[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function TransactionItemSearchPage() {
  const { tokens } = useAuth();
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ItemSearchResult[]>([]);

  const accessToken = useMemo(() => {
    const stored = JSON.parse(localStorage.getItem("authTokens") || "{}");
    return tokens?.access || stored?.access;
  }, [tokens?.access]);

  const searchItems = async () => {
    if (!query.trim()) return;
    if (!accessToken) {
      setError("Please log in again to search items.");
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/transactions/item_search/?q=${encodeURIComponent(query.trim())}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Item search failed");
      }

      const data = await res.json();
      const normalized = Array.isArray(data)
        ? data
        : Array.isArray(data.items)
          ? data.items
          : Array.isArray(data.results)
            ? data.results
            : [];
      setResults(normalized);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const groupedResults = useMemo(() => {
    const map = new Map<number, GroupedResult>();

    for (const r of results) {
      const txId = r.transaction_id || (r.transaction as { id?: number } | undefined)?.id;
      if (!txId) continue;
      const date =
        r.transaction_date ||
        r.transaction_timestamp ||
        r.transaction?.date ||
        r.transaction?.timestamp;
      const merchant =
        r.transaction_merchant ||
        r.transaction_description ||
        r.transaction?.merchant ||
        r.transaction?.description ||
        "Unknown";
      const amount = r.transaction_amount ?? r.transaction?.amount;

      if (!map.has(txId)) {
        map.set(txId, { transaction_id: txId, date, merchant, amount, items: [] });
      }
      map.get(txId)!.items.push(r);
    }

    return Array.from(map.values()).sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });
  }, [results]);

  const totalItemsFound = useMemo(
    () => groupedResults.reduce((sum, g) => sum + g.items.length, 0),
    [groupedResults]
  );

  const hasSearched = query.trim().length > 0 || results.length > 0 || Boolean(error);

  return (
    <div className="min-h-[81vh] w-full bg-[#121212] text-base font-sans pt-3 sm:pt-4 px-3 sm:px-6 lg:pl-24 lg:pr-12 pb-6">
      <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Item Search</h1>
          <p className="text-white/60 mt-1 max-w-2xl">
            Search extracted line items across all transactions and quickly inspect matching receipts.
          </p>
        </div>

        <Link href="/transactions" className="w-full sm:w-auto">
          <Button
            variant="outline"
            className="w-full sm:w-auto bg-[#1c1c1c] border-white/15 text-white hover:bg-[#2b2b2b]"
          >
            Back to Transactions
          </Button>
        </Link>
      </div>

      <div className="border border-white/10 rounded-2xl p-3 sm:p-4 bg-white/[0.02] shadow-sm backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search item name (e.g. milk, usb-c cable)"
            className="bg-[#121212] border-white/15"
            onKeyDown={(e) => {
              if (e.key === "Enter") searchItems();
            }}
          />
          <Button
            onClick={searchItems}
            disabled={isSearching || !query.trim()}
            className="sm:w-auto w-full"
          >
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Searching
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Search
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="mt-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
            {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <div className="border border-white/10 rounded-lg bg-white/[0.02] px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-white/50">Matching transactions</p>
          <p className="text-2xl font-semibold text-white mt-1">{groupedResults.length}</p>
        </div>
        <div className="border border-white/10 rounded-lg bg-white/[0.02] px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-white/50">Items found</p>
          <p className="text-2xl font-semibold text-white mt-1">{totalItemsFound}</p>
        </div>
        <div className="border border-white/10 rounded-lg bg-white/[0.02] px-4 py-3 sm:col-span-2 xl:col-span-1">
          <p className="text-[11px] uppercase tracking-wide text-white/50">Query</p>
          <p className="text-sm sm:text-base font-medium text-white mt-1 truncate">{query.trim() || "Waiting for search"}</p>
        </div>
      </div>

      <div className="border border-white/10 rounded-2xl overflow-hidden bg-white/[0.02]">
        {isSearching ? (
          <div className="p-4 sm:p-5 text-sm text-white/70 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching items...
          </div>
        ) : groupedResults.length === 0 ? (
          <div className="p-6 sm:p-10 text-center">
            <PackageSearch className="h-10 w-10 text-white/30 mx-auto" />
            <p className="text-sm text-white/70 mt-3">
              {hasSearched ? "No items found for this search." : "Start by searching for an item name."}
            </p>
            <p className="text-xs text-white/50 mt-1">Try keywords like grocery items, brands, or product types.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {groupedResults.map((group) => (
              <details key={group.transaction_id} className="group">
                <summary className="list-none cursor-pointer px-3 sm:px-4 py-3 hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-start sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm sm:text-base text-white truncate">{group.merchant}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-white/60">
                        <span>
                          {group.date ? formatDate(group.date, { format: "short" }) : "-"}
                        </span>
                        <span className="text-white/30">•</span>
                        <span>
                          {group.items.length} item{group.items.length > 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {typeof group.amount === "number" && (
                        <p className="text-sm text-white/90 font-medium">${group.amount.toFixed(2)}</p>
                      )}
                      <p className="text-[11px] text-white/50 mt-0.5">Txn #{group.transaction_id}</p>
                    </div>
                  </div>
                </summary>

                <div className="px-3 sm:px-4 pb-3">
                  <div className="border border-white/10 rounded-md overflow-hidden">
                    <div className="hidden sm:grid grid-cols-12 text-[11px] uppercase tracking-wide text-white/50 bg-white/[0.03] px-3 py-2">
                      <span className="col-span-7">Item</span>
                      <span className="col-span-2 text-right">Qty</span>
                      <span className="col-span-3 text-right">Price</span>
                    </div>
                    <div className="divide-y divide-white/10">
                      {group.items.map((result, idx) => {
                        const itemName = result.item_name || result.name || "Unnamed item";
                        const qty = result.quantity ?? result.qty ?? 1;
                        const itemPrice =
                          result.line_total ??
                          result.total_price ??
                          result.price ??
                          result.unit_price ??
                          0;

                        return (
                          <div key={`${result.id || idx}-${itemName}`}>
                            <div className="hidden sm:grid grid-cols-12 px-3 py-2 text-sm">
                              <span className="col-span-7 truncate pr-2 text-white">{itemName}</span>
                              <span className="col-span-2 text-right text-white/80">{qty}</span>
                              <span className="col-span-3 text-right text-white/80">${Number(itemPrice).toFixed(2)}</span>
                            </div>

                            <div className="sm:hidden px-3 py-2.5 space-y-1">
                              <p className="text-sm text-white break-words leading-snug">{itemName}</p>
                              <div className="mt-1 flex items-center justify-between text-xs text-white/70 gap-2">
                                <span className="inline-flex items-center rounded-full border border-white/10 px-2 py-0.5">
                                  Qty: {qty}
                                </span>
                                <span className="font-medium text-white/90">${Number(itemPrice).toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
