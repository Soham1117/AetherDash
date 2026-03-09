"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const starter = [
  { symbol: "QQQ", qty: 0, avg: 0, price: 599.75 },
  { symbol: "SCHD", qty: 0, avg: 0, price: 31.13 },
  { symbol: "DFAT", qty: 0, avg: 0, price: 62.56 },
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
    </div>
  );
}
