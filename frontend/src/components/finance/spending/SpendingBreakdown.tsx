"use client";

import { useState, useMemo } from "react";
import { useDash, TransactionListItem } from "@/context/DashboardContext";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export function SpendingBreakdown() {
  const { spendingList, transactionList } = useDash();
  const [selected, setSelected] = useState<string | null>(null);

  const expenseTransactions = useMemo(
    () =>
      transactionList.filter(
        (t) => t.transaction_type === "debit" && !t.is_transfer && (t.category || "").toLowerCase() !== "transfer"
      ),
    [transactionList]
  );

  const visibleTransactions = useMemo(() => {
    const list = selected
      ? expenseTransactions.filter((t) => t.category === selected)
      : expenseTransactions;
    return list
      .slice()
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [expenseTransactions, selected]);

  const maxExpense = spendingList.reduce((m, s) => Math.max(m, s.expense), 0);

  if (spendingList.length === 0) return null;

  return (
    <div className="border border-white/15 p-6 md:p-10 text-white w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-normal">Spending by Category</h2>
          <p className="text-sm text-white/40 mt-0.5">
            {selected ? `Showing ${selected} transactions` : "Click a category to filter transactions"}
          </p>
        </div>
        {selected && (
          <button
            onClick={() => setSelected(null)}
            className="text-xs text-white/40 hover:text-white border border-white/15 px-3 py-1.5 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6 lg:gap-10">

        {/* Left — category list */}
        <div className="flex flex-col gap-1 overflow-y-auto max-h-[520px] pr-1">
          {spendingList.map((s, i) => {
            const isActive = selected === s.name;
            const barWidth = maxExpense > 0 ? (s.expense / maxExpense) * 100 : 0;
            return (
              <button
                key={i}
                onClick={() => setSelected(isActive ? null : s.name)}
                className={`w-full text-left px-3 py-3 border transition-colors ${
                  isActive
                    ? "border-white/20 bg-white/5"
                    : "border-transparent hover:border-white/10 hover:bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 flex-shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-sm truncate">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <span className="text-sm font-mono text-white/80">{fmt(s.expense)}</span>
                    <span className="text-xs text-white/30 w-9 text-right">{s.percentage}%</span>
                  </div>
                </div>
                <div className="h-1 w-full bg-white/10">
                  <div
                    className="h-1 transition-all duration-300"
                    style={{ width: `${barWidth}%`, backgroundColor: s.color }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Right — transaction list */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs text-white/40 uppercase tracking-widest">Transactions</span>
            <span className="text-xs text-white/30">{visibleTransactions.length} shown</span>
          </div>

          <div className="overflow-y-auto max-h-[480px] flex flex-col divide-y divide-white/[0.06]">
            {visibleTransactions.length === 0 && (
              <div className="text-white/30 text-sm py-10 text-center">
                No expense transactions{selected ? ` in ${selected}` : ""}
              </div>
            )}
            {visibleTransactions.map((t) => {
              const cat = spendingList.find((s) => s.name === t.category);
              return (
                <div key={t.id} className="flex items-center gap-3 px-1 py-2.5">
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat?.color ?? "#666" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{t.description}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-white/30">
                        {new Date(t.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      {t.account && (
                        <span className="text-xs text-white/20">· {t.account}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-mono text-white/70 flex-shrink-0">
                    {fmt(t.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
