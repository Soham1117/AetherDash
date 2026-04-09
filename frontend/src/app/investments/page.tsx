"use client";

import { Card, CardContent } from "@/components/ui/card";

type Holding = {
  symbol: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
};

type Purchase = {
  date: string;
  symbol: string;
  shares: number;
  price: number;
  note?: string;
};

const holdings: Holding[] = [
  { symbol: "QQQ", shares: 0.558, avgCost: 598.17, currentPrice: 606.09 },
  { symbol: "SCHD", shares: 10.765638, avgCost: 30.96, currentPrice: 30.86 },
  { symbol: "DFAT", shares: 1.281, avgCost: 64.78, currentPrice: 64.69 },
];

const purchaseHistory: Purchase[] = [
  { date: "Manual update", symbol: "DFAT", shares: 1.281, price: 64.78 },
  { date: "Manual update", symbol: "QQQ", shares: 0.138, price: 601.37 },
  { date: "Manual update", symbol: "QQQ", shares: 0.208, price: 603.33 },
  { date: "Manual update", symbol: "QQQ", shares: 0.212, price: 589.68 },
  { date: "Manual update", symbol: "SCHD", shares: 2.632638, price: 31.46 },
  { date: "Manual update", symbol: "SCHD", shares: 4.037, price: 30.96 },
  { date: "Manual update", symbol: "SCHD", shares: 4.096, price: 30.52 },
];

const futureAllocation = [
  { symbol: "QQQM", pct: 30 },
  { symbol: "SCHD", pct: 25 },
  { symbol: "VXUS", pct: 20 },
  { symbol: "VB", pct: 25 },
];

function money(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}

function pct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export default function InvestmentsPage() {
  const enriched = holdings.map((h) => {
    const costBasis = h.shares * h.avgCost;
    const marketValue = h.shares * h.currentPrice;
    const pl = marketValue - costBasis;
    const plPct = costBasis > 0 ? (pl / costBasis) * 100 : 0;
    return { ...h, costBasis, marketValue, pl, plPct };
  });

  const totalValue = enriched.reduce((sum, h) => sum + h.marketValue, 0);
  const totalCost = enriched.reduce((sum, h) => sum + h.costBasis, 0);
  const totalPl = totalValue - totalCost;
  const totalPlPct = totalCost > 0 ? (totalPl / totalCost) * 100 : 0;

  return (
    <div className="min-h-[81vh] w-full bg-[#121212] text-white font-sans pt-3 sm:pt-4 mb-20 px-3 sm:px-6 lg:pl-24 lg:pr-12 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Investments</h1>
        <p className="text-white/60 mt-1">Current portfolio, performance, purchase history, and future allocation targets.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-[#1c1c1c] border-white/10"><CardContent className="p-4"><p className="text-xs text-white/50 uppercase tracking-wide">Portfolio Value</p><p className="text-2xl font-semibold mt-2">{money(totalValue)}</p></CardContent></Card>
        <Card className="bg-[#1c1c1c] border-white/10"><CardContent className="p-4"><p className="text-xs text-white/50 uppercase tracking-wide">Cost Basis</p><p className="text-2xl font-semibold mt-2">{money(totalCost)}</p></CardContent></Card>
        <Card className="bg-[#1c1c1c] border-white/10"><CardContent className="p-4"><p className="text-xs text-white/50 uppercase tracking-wide">Total P/L</p><p className={`text-2xl font-semibold mt-2 ${totalPl >= 0 ? "text-green-400" : "text-red-400"}`}>{money(totalPl)} <span className="text-base">({pct(totalPlPct)})</span></p></CardContent></Card>
      </div>

      <div className="bg-[#1c1c1c] border border-white/10 rounded-lg overflow-hidden">
        <div className="px-4 py-3 text-sm font-semibold border-b border-white/10">Current Portfolio</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-white/50 border-b border-white/10">
              <tr>
                <th className="text-left px-4 py-3">Symbol</th>
                <th className="text-right px-4 py-3">Shares</th>
                <th className="text-right px-4 py-3">Avg Cost</th>
                <th className="text-right px-4 py-3">Current</th>
                <th className="text-right px-4 py-3">Value</th>
                <th className="text-right px-4 py-3">Weight</th>
                <th className="text-right px-4 py-3">P/L</th>
              </tr>
            </thead>
            <tbody>
              {enriched.map((h) => (
                <tr key={h.symbol} className="border-b border-white/5">
                  <td className="px-4 py-3 font-medium">{h.symbol}</td>
                  <td className="px-4 py-3 text-right">{h.shares.toFixed(4)}</td>
                  <td className="px-4 py-3 text-right">{money(h.avgCost)}</td>
                  <td className="px-4 py-3 text-right">{money(h.currentPrice)}</td>
                  <td className="px-4 py-3 text-right">{money(h.marketValue)}</td>
                  <td className="px-4 py-3 text-right">{pct((h.marketValue / totalValue) * 100)}</td>
                  <td className={`px-4 py-3 text-right ${h.pl >= 0 ? "text-green-400" : "text-red-400"}`}>{money(h.pl)} ({pct(h.plPct)})</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-[#1c1c1c] border border-white/10 rounded-lg overflow-hidden">
          <div className="px-4 py-3 text-sm font-semibold border-b border-white/10">Purchase History</div>
          <div className="divide-y divide-white/10">
            {purchaseHistory.map((p, i) => (
              <div key={`${p.symbol}-${p.date}-${i}`} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{p.symbol}</div>
                    <div className="text-sm text-white/60">{p.date}{p.note ? ` • ${p.note}` : ""}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div>{p.shares.toFixed(6)} shares</div>
                    <div className="text-white/60">@ {money(p.price)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#1c1c1c] border border-white/10 rounded-lg overflow-hidden">
          <div className="px-4 py-3 text-sm font-semibold border-b border-white/10">Future Investments</div>
          <div className="divide-y divide-white/10">
            {futureAllocation.map((row) => (
              <div key={row.symbol} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="font-medium">{row.symbol}</div>
                  <div className="text-sm text-white/60">Target for new money only</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-green-400">{row.pct}%</div>
                  <div className="text-xs text-white/50">Per $1000: {money((1000 * row.pct) / 100)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
