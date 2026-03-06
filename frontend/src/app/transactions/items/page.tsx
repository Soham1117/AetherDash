"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";

type ItemSearchResult = {
  id?: number;
  item_name?: string;
  name?: string;
  quantity?: number;
  qty?: number;
  price?: number;
  total_price?: number;
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function TransactionItemSearchPage() {
  const router = useRouter();
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
    const map = new Map<number, {
      transaction_id: number;
      date?: string;
      merchant?: string;
      amount?: number;
      items: ItemSearchResult[];
    }>();

    for (const r of results) {
      const txId = r.transaction_id || (typeof r.transaction === 'number' ? r.transaction : r.transaction?.id);
      if (!txId) continue;
      const date = r.transaction_date || r.transaction_timestamp || r.transaction?.date || r.transaction?.timestamp;
      const merchant = r.transaction_merchant || r.transaction_description || r.transaction?.merchant || r.transaction?.description || "Unknown";
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

  const onResultClick = (txId: number) => {
    if (!txId) return;
    router.push(`/transactions?transactionId=${txId}`);
  };

  return (
    <div className="flex flex-col gap-4 min-h-[81vh] w-full bg-[#121212] text-base font-sans pt-4 mb-20 pl-24 pr-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Item Search</h1>
        <p className="text-white/60 mt-1">Search extracted line items across all transactions.</p>
      </div>

      <div className="border border-white/10 rounded-lg p-4 bg-[#121212]">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search item name (e.g. milk, usb-c cable)"
            className="bg-[#121212] border-white/15"
            onKeyDown={(e) => {
              if (e.key === "Enter") searchItems();
            }}
          />
          <Button onClick={searchItems} disabled={isSearching || !query.trim()}>
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {error && (
          <div className="mt-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
            {error}
          </div>
        )}
      </div>

      <div className="border border-white/10 rounded-lg overflow-hidden">
        {isSearching ? (
          <div className="p-4 text-sm text-white/60 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching...
          </div>
        ) : groupedResults.length === 0 ? (
          <div className="p-4 text-sm text-white/50">No items found.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {groupedResults.map((group) => (
              <details key={group.transaction_id} className="group">
                <summary className="list-none cursor-pointer px-4 py-3 hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{group.merchant}</p>
                      <p className="text-xs text-white/60">
                        {group.date ? formatDate(group.date, { format: "short" }) : "-"} • {group.items.length} item{group.items.length > 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-white/90">Txn #{group.transaction_id}</p>
                      {typeof group.amount === "number" && (
                        <p className="text-xs text-white/60">${group.amount.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                </summary>

                <div className="px-4 pb-3">
                  <div className="border border-white/10 rounded-md overflow-hidden">
                    <div className="grid grid-cols-12 text-[11px] uppercase tracking-wide text-white/50 bg-white/[0.03] px-3 py-2">
                      <span className="col-span-7">Item</span>
                      <span className="col-span-2 text-right">Qty</span>
                      <span className="col-span-3 text-right">Price</span>
                    </div>
                    <div className="divide-y divide-white/10">
                      {group.items.map((result, idx) => {
                        const itemName = result.item_name || result.name || "Unnamed item";
                        const qty = result.quantity ?? result.qty ?? 1;
                        const itemPrice = result.total_price ?? result.price ?? 0;
                        return (
                          <div key={`${result.id || idx}-${itemName}`} className="grid grid-cols-12 px-3 py-2 text-sm">
                            <span className="col-span-7 truncate pr-2 text-white">{itemName}</span>
                            <span className="col-span-2 text-right text-white/80">{qty}</span>
                            <span className="col-span-3 text-right text-white/80">${Number(itemPrice).toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-2">
                    <Button size="sm" variant="outline" onClick={() => onResultClick(group.transaction_id)}>
                      Open Transaction
                    </Button>
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
