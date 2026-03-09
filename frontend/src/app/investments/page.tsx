"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const starter = [
  { symbol: "QQQ", qty: 0, avg: 603.3250, price: 599.75 },
  { symbol: "SCHD", qty: 0, avg: 30.9625, price: 31.13 },
  { symbol: "DFAT", qty: 0, avg: 64.7800, price: 62.56 },
];

const recentTradeConfirmations = [
  {
    date: "2026-03-07",
    account: "XXXXX7346",
    trades: [
      { action: "BOUGHT", security: "Invesco QQQ Trust Series 1", symbol: "QQQ", price: 603.3250 },
      { action: "BOUGHT", security: "Schwab U.S. Dividend Equity ETF", symbol: "SCHD", price: 30.9600 },
      { action: "BOUGHT", security: "Schwab U.S. Dividend Equity ETF", symbol: "SCHD", price: 30.9650 },
    ],
  },
  {
    date: "2026-02-24",
    account: "XXXXX7346",
    trades: [
      { action: "BOUGHT", security: "Dimensional ETF Trust US Targeted", symbol: "DFAT", price: 64.7800 },
      { action: "BOUGHT", security: "Dimensional ETF Trust US Targeted", symbol: "DFAT", price: 64.7800 },
      { action: "BOUGHT", security: "Invesco QQQ Trust Series 1", symbol: "QQQ", price: 601.3745 },
      { action: "BOUGHT", security: "Schwab U.S. Dividend Equity ETF", symbol: "SCHD", price: 31.4550 },
      { action: "BOUGHT", security: "Schwab U.S. Dividend Equity ETF", symbol: "SCHD", price: 31.4550 },
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
    <div className="min-h-[81vh] w-full bg-[#121212] text-white font-sans pt-6 mb-20 pl-24 pr-10 space-y-5">
      <div>
        <h1 className="text-3xl font-bold">Investments</h1>
        <p className="text-white/60 mt-1">Track holdings, P/L, and watchlist in one place.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="border border-white/10 bg-[#1c1c1c] p-3">Market Value<br/><span className="text-xl font-semibold">${totals.market.toFixed(2)}</span></div>
        <div className="border border-white/10 bg-[#1c1c1c] p-3">Cost Basis<br/><span className="text-xl font-semibold">${totals.cost.toFixed(2)}</span></div>
        <div className="border border-white/10 bg-[#1c1c1c] p-3">Unrealized P/L<br/><span className={`text-xl font-semibold ${totals.pnl>=0?'text-green-400':'text-red-400'}`}>${totals.pnl.toFixed(2)}</span></div>
        <div className="border border-white/10 bg-[#1c1c1c] p-3">Return %<br/><span className={`text-xl font-semibold ${totals.pnlPct>=0?'text-green-400':'text-red-400'}`}>{totals.pnlPct.toFixed(2)}%</span></div>
      </div>

      <div className="border border-white/10 rounded-lg overflow-hidden">
        <div className="grid grid-cols-5 text-xs uppercase tracking-wide text-white/50 bg-white/[0.03] px-3 py-2">
          <span>Symbol</span><span className="text-right">Qty</span><span className="text-right">Avg Price</span><span className="text-right">Last Price</span><span className="text-right">Value</span>
        </div>
        <div className="divide-y divide-white/10">
          {rows.map((r, i) => (
            <div key={r.symbol} className="grid grid-cols-5 px-3 py-2 items-center gap-2">
              <Input value={r.symbol} onChange={(e)=>setRows(rows.map((x,ix)=>ix===i?{...x,symbol:e.target.value.toUpperCase()}:x))} className="bg-[#121212] border-white/10 h-8" />
              <Input type="number" value={r.qty} onChange={(e)=>setRows(rows.map((x,ix)=>ix===i?{...x,qty:Number(e.target.value||0)}:x))} className="text-right bg-[#121212] border-white/10 h-8" />
              <Input type="number" value={r.avg} onChange={(e)=>setRows(rows.map((x,ix)=>ix===i?{...x,avg:Number(e.target.value||0)}:x))} className="text-right bg-[#121212] border-white/10 h-8" />
              <Input type="number" value={r.price} onChange={(e)=>setRows(rows.map((x,ix)=>ix===i?{...x,price:Number(e.target.value||0)}:x))} className="text-right bg-[#121212] border-white/10 h-8" />
              <div className="text-right text-sm">${(r.qty*r.price).toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>

      <Button variant="outline" onClick={() => setRows([...rows, { symbol: "", qty: 0, avg: 0, price: 0 }])}>+ Add Holding</Button>

      <div className="border border-white/10 rounded-lg overflow-hidden mt-2">
        <div className="px-3 py-2 text-xs uppercase tracking-wide text-white/50 bg-white/[0.03]">Recent Trade Confirmations (from email)</div>
        <div className="divide-y divide-white/10">
          {recentTradeConfirmations.map((batch, i) => (
            <details key={i} className="group">
              <summary className="list-none cursor-pointer px-3 py-2 hover:bg-white/[0.03] flex items-center justify-between">
                <span className="text-sm">{batch.date} • {batch.account}</span>
                <span className="text-xs text-white/60">{batch.trades.length} trades</span>
              </summary>
              <div className="px-3 pb-3">
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
