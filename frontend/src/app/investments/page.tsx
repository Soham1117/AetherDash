"use client";

import { Card, CardContent } from "@/components/ui/card";

const targetSplit = [
  { symbol: "QQQM", pct: 30 },
  { symbol: "SCHD", pct: 25 },
  { symbol: "VXUS", pct: 20 },
  { symbol: "VB", pct: 25 },
];

const currentBaseline = [
  { symbol: "QQQ", note: "Existing holding, keep" },
  { symbol: "SCHD", note: "Existing holding, keep" },
  { symbol: "DFAT", note: "Existing holding, keep, not part of new split" },
];

const monthlyTarget = 1000;
const twoMonthTarget = 2000;

export default function InvestmentsPage() {
  return (
    <div className="min-h-[81vh] w-full bg-[#121212] text-white font-sans pt-3 sm:pt-4 mb-20 px-3 sm:px-6 lg:pl-24 lg:pr-12 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Investments</h1>
        <p className="text-white/60 mt-1">2-month guided deployment plan, current baseline, and target allocation for new money.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card className="bg-[#1c1c1c] border-white/10"><CardContent className="p-4"><p className="text-xs text-white/50 uppercase tracking-wide">2-Month Target</p><p className="text-2xl font-semibold mt-2">${twoMonthTarget}</p></CardContent></Card>
        <Card className="bg-[#1c1c1c] border-white/10"><CardContent className="p-4"><p className="text-xs text-white/50 uppercase tracking-wide">Monthly Target</p><p className="text-2xl font-semibold mt-2">${monthlyTarget}</p></CardContent></Card>
        <Card className="bg-[#1c1c1c] border-white/10"><CardContent className="p-4"><p className="text-xs text-white/50 uppercase tracking-wide">Default Timing Rule</p><p className="text-lg font-semibold mt-2">Weekday noon signal</p></CardContent></Card>
        <Card className="bg-[#1c1c1c] border-white/10"><CardContent className="p-4"><p className="text-xs text-white/50 uppercase tracking-wide">Completion Rule</p><p className="text-lg font-semibold mt-2">Finish by end of month 2</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-[#1c1c1c] border border-white/10 rounded-lg overflow-hidden">
          <div className="px-4 py-3 text-sm font-semibold border-b border-white/10">New Money Target Split</div>
          <div className="divide-y divide-white/10">
            {targetSplit.map((row) => (
              <div key={row.symbol} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="font-medium">{row.symbol}</div>
                  <div className="text-xs text-white/50">Per $1000: ${(monthlyTarget * row.pct / 100).toFixed(0)}</div>
                </div>
                <div className="text-lg font-semibold text-green-400">{row.pct}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#1c1c1c] border border-white/10 rounded-lg overflow-hidden">
          <div className="px-4 py-3 text-sm font-semibold border-b border-white/10">Current Baseline Holdings</div>
          <div className="divide-y divide-white/10">
            {currentBaseline.map((row) => (
              <div key={row.symbol} className="px-4 py-3">
                <div className="font-medium">{row.symbol}</div>
                <div className="text-sm text-white/60">{row.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#1c1c1c] border border-white/10 rounded-lg overflow-hidden">
        <div className="px-4 py-3 text-sm font-semibold border-b border-white/10">How this plan works</div>
        <div className="p-4 space-y-3 text-sm text-white/80">
          <p>1. New contributions from this month onward follow the split: QQQM 30%, SCHD 25%, VXUS 20%, VB 25%.</p>
          <p>2. Existing QQQ, SCHD, and DFAT positions are retained. No forced selling is assumed.</p>
          <p>3. A weekday noon signal decides whether the market looks like a buy window, neutral day, or hold-off day.</p>
          <p>4. Monthly pace is tracked against $1000, but the real hard deadline is deploying $2000 by the end of the second month.</p>
          <p>5. If timing never gets attractive enough, deployment should still finish by the end of month 2.</p>
        </div>
      </div>

      <div className="bg-[#1c1c1c] border border-white/10 rounded-lg overflow-hidden">
        <div className="px-4 py-3 text-sm font-semibold border-b border-white/10">Suggested Deployment Examples</div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          <div className="rounded-md border border-white/10 p-3 bg-white/[0.02]">
            <div className="font-medium mb-2">$250 buy day</div>
            <div>QQQM $75</div>
            <div>SCHD $62.50</div>
            <div>VXUS $50</div>
            <div>VB $62.50</div>
          </div>
          <div className="rounded-md border border-white/10 p-3 bg-white/[0.02]">
            <div className="font-medium mb-2">$500 buy day</div>
            <div>QQQM $150</div>
            <div>SCHD $125</div>
            <div>VXUS $100</div>
            <div>VB $125</div>
          </div>
          <div className="rounded-md border border-white/10 p-3 bg-white/[0.02]">
            <div className="font-medium mb-2">$1000 month</div>
            <div>QQQM $300</div>
            <div>SCHD $250</div>
            <div>VXUS $200</div>
            <div>VB $250</div>
          </div>
        </div>
      </div>
    </div>
  );
}
