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

  const onResultClick = (result: ItemSearchResult) => {
    const txId = result.transaction_id || result.transaction?.id;
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
        <div className="grid grid-cols-12 text-xs uppercase tracking-wide text-white/50 bg-white/[0.03] px-4 py-2">
          <span className="col-span-4">Item</span>
          <span className="col-span-2 text-right">Qty</span>
          <span className="col-span-2 text-right">Price</span>
          <span className="col-span-2">Date</span>
          <span className="col-span-2">Merchant</span>
        </div>

        {isSearching ? (
          <div className="p-4 text-sm text-white/60 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching...
          </div>
        ) : results.length === 0 ? (
          <div className="p-4 text-sm text-white/50">No items found.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {results.map((result, idx) => {
              const itemName = result.item_name || result.name || "Unnamed item";
              const qty = result.quantity ?? result.qty ?? 1;
              const itemPrice = result.total_price ?? result.price ?? 0;
              const txDate = result.transaction_date || result.transaction_timestamp || result.transaction?.date || result.transaction?.timestamp;
              const merchant = result.transaction_merchant || result.transaction_description || result.transaction?.merchant || result.transaction?.description || "Unknown";
              const txAmount = result.transaction_amount ?? result.transaction?.amount;

              return (
                <button
                  key={`${result.id || idx}-${itemName}`}
                  onClick={() => onResultClick(result)}
                  className="w-full text-left grid grid-cols-12 px-4 py-3 hover:bg-white/[0.03] transition-colors"
                >
                  <span className="col-span-4 truncate pr-2 text-white">{itemName}</span>
                  <span className="col-span-2 text-right text-white/80">{qty}</span>
                  <span className="col-span-2 text-right text-white/80">${Number(itemPrice).toFixed(2)}</span>
                  <span className="col-span-2 text-white/70">{txDate ? formatDate(txDate, { format: "short" }) : "-"}</span>
                  <span className="col-span-2 truncate text-white/70">
                    {merchant}
                    {typeof txAmount === "number" && (
                      <span className="text-white/40 ml-1">(${txAmount.toFixed(2)})</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
