"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, ChevronDown } from "lucide-react";

const starter = [
  { symbol: "QQQ", qty: 0, avg: 603.325, price: 599.75 },
  { symbol: "SCHD", qty: 0, avg: 30.9625, price: 31.13 },
  { symbol: "DFAT", qty: 0, avg: 64.78, price: 62.56 },
];

const recentTradeConfirmations = [
  {
    date: "2026-03-07",
    account: "XXXXX7346",
    trades: [
      { action: "BOUGHT", security: "Invesco QQQ Trust Series 1", symbol: "QQQ", price: 603.325 },
      { action: "BOUGHT", security: "Schwab U.S. Dividend Equity ETF", symbol: "SCHD", price: 30.96 },
      { action: "BOUGHT", security: "Schwab U.S. Dividend Equity ETF", symbol: "SCHD", price: 30.965 },
    ],
  },
  {
    date: "2026-02-24",
    account: "XXXXX7346",
    trades: [
      { action: "BOUGHT", security: "Dimensional ETF Trust US Targeted", symbol: "DFAT", price: 64.78 },
      { action: "BOUGHT", security: "Dimensional ETF Trust US Targeted", symbol: "DFAT", price: 64.78 },
      { action: "BOUGHT", security: "Invesco QQQ Trust Series 1", symbol: "QQQ", price: 601.3745 },
      { action: "BOUGHT", security: "Schwab U.S. Dividend Equity ETF", symbol: "SCHD", price: 31.455 },
      { action: "BOUGHT", security: "Schwab U.S. Dividend Equity ETF", symbol: "SCHD", price: 31.455 },
    ],
  },
];

export default function InvestmentsPage() {
  const [rows, setRows] = useState(starter);

  const totals = useMemo(() => {
    const market = rows.reduce((s, r) => s + r.qty * r.price, 0);
    const cost = rows.reduce((s, r) => s + r.qty * r.avg, 0);
    const pnl = market - cost;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
    return { market, cost, pnl, pnlPct };
  }, [rows]);

  return (
    <div className="min-h-[81vh] w-full bg-[#121212] text-white font-sans pt-3 sm:pt-4 mb-20 px-3 sm:px-6 lg:pl-24 lg:pr-12 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Investments</h1>
        <p className="text-white/60 mt-1">Track holdings, returns, and recent trade confirmations.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card className="bg-[#1c1c1c] border-white/10">
          <CardContent className="p-4">
            <p className="text-xs text-white/50 uppercase tracking-wide">Market Value</p>
            <p className="text-2xl font-semibold mt-2">${totals.market.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1c1c1c] border-white/10">
          <CardContent className="p-4">
            <p className="text-xs text-white/50 uppercase tracking-wide">Cost Basis</p>
            <p className="text-2xl font-semibold mt-2">${totals.cost.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1c1c1c] border-white/10">
          <CardContent className="p-4">
            <p className="text-xs text-white/50 uppercase tracking-wide">Unrealized P/L</p>
            <p className={`text-2xl font-semibold mt-2 ${totals.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
              ${totals.pnl.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#1c1c1c] border-white/10">
          <CardContent className="p-4">
            <p className="text-xs text-white/50 uppercase tracking-wide">Return %</p>
            <p className={`text-2xl font-semibold mt-2 ${totals.pnlPct >= 0 ? "text-green-400" : "text-red-400"}`}>
              {totals.pnlPct.toFixed(2)}%
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-[#1c1c1c] border border-white/10 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-semibold">Holdings</h3>
            <p className="text-xs text-white/50">Edit symbols, quantity, and prices to update totals instantly.</p>
          </div>
          <Button variant="outline" onClick={() => setRows([...rows, { symbol: "", qty: 0, avg: 0, price: 0 }])}>
            <Plus className="h-4 w-4 mr-2" /> Add Holding
          </Button>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-6 text-xs uppercase tracking-wide text-white/50 bg-white/[0.03] px-3 py-2">
              <span>Symbol</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Avg Price</span>
              <span className="text-right">Last Price</span>
              <span className="text-right">Value</span>
              <span className="text-right">P/L</span>
            </div>
            <div className="divide-y divide-white/10">
              {rows.map((r, i) => {
                const rowValue = r.qty * r.price;
                const rowCost = r.qty * r.avg;
                const rowPnl = rowValue - rowCost;
                return (
                  <div key={`${r.symbol}-${i}`} className="grid grid-cols-6 px-3 py-2.5 items-center gap-2">
                    <Input
                      value={r.symbol}
                      onChange={(e) =>
                        setRows(rows.map((x, ix) => (ix === i ? { ...x, symbol: e.target.value.toUpperCase() } : x)))
                      }
                      className="bg-[#121212] border-white/10 h-9"
                    />
                    <Input
                      type="number"
                      value={r.qty}
                      onChange={(e) => setRows(rows.map((x, ix) => (ix === i ? { ...x, qty: Number(e.target.value || 0) } : x)))}
                      className="text-right bg-[#121212] border-white/10 h-9"
                    />
                    <Input
                      type="number"
                      value={r.avg}
                      onChange={(e) => setRows(rows.map((x, ix) => (ix === i ? { ...x, avg: Number(e.target.value || 0) } : x)))}
                      className="text-right bg-[#121212] border-white/10 h-9"
                    />
                    <Input
                      type="number"
                      value={r.price}
                      onChange={(e) =>
                        setRows(rows.map((x, ix) => (ix === i ? { ...x, price: Number(e.target.value || 0) } : x)))
                      }
                      className="text-right bg-[#121212] border-white/10 h-9"
                    />
                    <div className="text-right text-sm font-medium">${rowValue.toFixed(2)}</div>
                    <div className={`text-right text-sm font-medium ${rowPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                      ${rowPnl.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#1c1c1c] border border-white/10 rounded-lg overflow-hidden">
        <div className="px-4 py-3 text-sm font-semibold border-b border-white/10">Recent Trade Confirmations (from email)</div>
        <div className="divide-y divide-white/10">
          {recentTradeConfirmations.map((batch, i) => (
            <details key={i} className="group">
              <summary className="list-none cursor-pointer px-4 py-3 hover:bg-white/[0.03] flex items-center justify-between gap-2">
                <span className="text-sm">
                  {batch.date} • {batch.account}
                </span>
                <span className="flex items-center gap-2 text-xs text-white/60">
                  {batch.trades.length} trades
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </span>
              </summary>
              <div className="px-4 pb-4">
                <div className="border border-white/10 rounded-md overflow-hidden">
                  <div className="grid grid-cols-12 text-[11px] uppercase tracking-wide text-white/50 bg-white/[0.03] px-2 py-1.5">
                    <span className="col-span-2">Action</span>
                    <span className="col-span-6">Security</span>
                    <span className="col-span-2">Symbol</span>
                    <span className="col-span-2 text-right">Price</span>
                  </div>
                  {batch.trades.map((t, idx) => (
                    <div key={idx} className="grid grid-cols-12 px-2 py-1.5 text-sm border-t border-white/10">
                      <span className="col-span-2 text-green-400">{t.action}</span>
                      <span className="col-span-6 truncate pr-2">{t.security}</span>
                      <span className="col-span-2">{t.symbol}</span>
                      <span className="col-span-2 text-right">${t.price.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
