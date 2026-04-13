"use client";

import { useState, useMemo } from "react";
import { useDash } from "@/context/DashboardContext";
import { ChevronLeft, ChevronRight } from "lucide-react";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const COLORS = [
  "#FF2D2D","#2DFF55","#2D2DFF","#FF2DFF","#2DFFFF","#FFFF2D","#FF552D",
  "#6633FF","#FF6633","#33FFCC","#E6399B","#39E6E6","#E67339","#39E639",
];

export function SpendingBreakdown() {
  const { transactionList } = useDash();
  const [selected, setSelected] = useState<string | null>(null);
  const [monthIndex, setMonthIndex] = useState<number>(0); // 0 = most recent

  // Build sorted list of unique months (most recent first)
  const months = useMemo(() => {
    const set = new Set<string>();
    transactionList.forEach((t) => {
      const d = new Date(t.timestamp);
      if (!isNaN(d.getTime())) set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a)); // newest first
  }, [transactionList]);

  const currentMonth = months[monthIndex] ?? null;

  const monthLabel = useMemo(() => {
    if (!currentMonth) return "All";
    const [y, m] = currentMonth.split("-");
    return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [currentMonth]);

  // Expense transactions for the selected month
  const monthTransactions = useMemo(() => {
    return transactionList.filter((t) => {
      if (t.transaction_type !== "debit" || t.is_transfer || (t.category || "").toLowerCase() === "transfer") return false;
      if (!currentMonth) return true;
      const d = new Date(t.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return key === currentMonth;
    });
  }, [transactionList, currentMonth]);

  // Category totals for the month
  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    monthTransactions.forEach((t) => {
      const cat = t.category || "Uncategorized";
      map[cat] = (map[cat] || 0) + t.amount;
    });
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, expense], i) => ({
        name,
        expense,
        percentage: total > 0 ? Math.round((expense / total) * 100) : 0,
        color: COLORS[i % COLORS.length],
      }));
  }, [monthTransactions]);

  const maxExpense = categoryTotals.reduce((m, s) => Math.max(m, s.expense), 0);

  // Transactions visible on the right (filtered by selected category)
  const visibleTransactions = useMemo(() => {
    const list = selected
      ? monthTransactions.filter((t) => (t.category || "Uncategorized") === selected)
      : monthTransactions;
    return list.slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [monthTransactions, selected]);

  if (months.length === 0) return null;

  return (
    <div className="border border-white/15 p-6 md:p-10 text-white w-full h-[400px] flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h2 className="text-lg font-normal">Spending by Category</h2>
          <p className="text-sm text-white/40 mt-0.5">
            {selected ? `${selected} · ${monthLabel}` : monthLabel}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {selected && (
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-white/40 hover:text-white border border-white/15 px-3 py-1.5 transition-colors"
            >
              Clear
            </button>
          )}
          {/* Month navigator */}
          <div className="flex items-center gap-1 border border-white/15">
            <button
              onClick={() => { setMonthIndex((i) => Math.min(i + 1, months.length - 1)); setSelected(null); }}
              disabled={monthIndex >= months.length - 1}
              className="p-1.5 hover:bg-white/5 disabled:opacity-20 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm px-2 min-w-[120px] text-center">{monthLabel}</span>
            <button
              onClick={() => { setMonthIndex((i) => Math.max(i - 1, 0)); setSelected(null); }}
              disabled={monthIndex <= 0}
              className="p-1.5 hover:bg-white/5 disabled:opacity-20 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Two-column body — both columns same height, each scrolls independently */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6 lg:gap-10 flex-1 min-h-0">

        {/* Left — categories */}
        <div className="overflow-y-auto flex flex-col gap-1 pr-1">
          {categoryTotals.length === 0 && (
            <div className="text-white/30 text-sm py-10 text-center">No expenses this month</div>
          )}
          {categoryTotals.map((s, i) => {
            const isActive = selected === s.name;
            const barWidth = maxExpense > 0 ? (s.expense / maxExpense) * 100 : 0;
            return (
              <button
                key={i}
                onClick={() => setSelected(isActive ? null : s.name)}
                className={`w-full text-left px-3 py-3 border transition-colors flex-shrink-0 ${
                  isActive ? "border-white/20 bg-white/5" : "border-transparent hover:border-white/10 hover:bg-white/[0.03]"
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
                  <div className="h-1 transition-all duration-300" style={{ width: `${barWidth}%`, backgroundColor: s.color }} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Right — transactions */}
        <div className="overflow-y-auto border-l border-white/[0.06] pl-6">
          <div className="flex items-center justify-between mb-3 sticky top-0 bg-[#121212] pb-2">
            <span className="text-xs text-white/40 uppercase tracking-widest">Transactions</span>
            <span className="text-xs text-white/30">{visibleTransactions.length} transaction{visibleTransactions.length !== 1 ? "s" : ""}</span>
          </div>

          {visibleTransactions.length === 0 && (
            <div className="text-white/30 text-sm py-10 text-center">
              No transactions{selected ? ` in ${selected}` : ""}
            </div>
          )}

          <div className="flex flex-col">
            {visibleTransactions.map((t) => {
              const cat = categoryTotals.find((s) => s.name === (t.category || "Uncategorized"));
              const desc = t.description?.trim() || "—";
              return (
                <div key={t.id} className="flex items-center gap-3 py-2 border-b border-white/[0.06] last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat?.color ?? "#666" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate text-white/90" title={desc}>{desc}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-white/30">
                        {new Date(t.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                      {t.account && (
                        <span className="text-xs text-white/20 truncate max-w-[80px]">· {t.account}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-mono text-white/70 flex-shrink-0 tabular-nums">{fmt(t.amount)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
