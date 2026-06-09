"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Activity, AlertCircle, BarChart3, CheckCircle2, Newspaper, RefreshCw, Shield, Target, Wallet } from "lucide-react";

import api from "@/components/finance/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Holding = {
  id: number;
  symbol: string;
  name: string;
  quantity: string;
  average_purchase_price: string;
  current_price: string;
  market_value: string;
  cost_basis: string;
  weight_percent: string;
  as_of: string;
};

type Order = {
  id: number;
  provider_order_id: string;
  symbol: string;
  side: string;
  status: string;
  order_type: string;
  quantity: string;
  filled_quantity: string;
  average_filled_price: string;
  placed_at: string | null;
  executed_at: string | null;
};

type InvestmentAccount = {
  id: number;
  provider_account_id: string;
  account_name: string;
  brokerage_name: string;
  account_type: string;
  account_number_mask: string;
  currency: string;
  total_value: string;
  cash_balance: string;
  buying_power: string;
  is_active: boolean;
  last_synced_at: string | null;
  holdings: Holding[];
  orders: Order[];
};

type Connection = {
  brokerage_name: unknown;
  status: string;
  last_synced_at: string | null;
  disabled_reason: string;
};

type PortfolioResponse = {
  connected: boolean;
  connection: Connection | null;
  accounts: InvestmentAccount[];
  totals: {
    portfolio_value: number;
    cash_balance: number;
    buying_power: number;
    account_count: number;
  };
  as_of: string | null;
};

type MarketTrackedSymbol = {
  id: number;
  symbol: string;
  name: string;
  asset_type: string;
  provider: string;
  target_weight_percent: string | null;
  active: boolean;
  updated_at: string;
};

type MarketMetrics = {
  symbol: string;
  as_of: string;
  provider: string;
  latest_close: string | null;
  return_1d_percent: string | null;
  return_5d_percent: string | null;
  return_1m_percent: string | null;
  volatility_20d_percent: string | null;
  moving_average_20d: string | null;
  moving_average_50d: string | null;
  rsi_14: string | null;
  updated_at: string;
};

type MarketNewsArticle = {
  symbol: string;
  provider: string;
  title: string;
  publisher: string;
  url: string;
  summary: string;
  thumbnail_url: string;
  published_at: string | null;
  updated_at: string;
};

type MarketSummaryResponse = {
  symbols: Array<{
    symbol: MarketTrackedSymbol;
    metrics: MarketMetrics | null;
    news: MarketNewsArticle[];
  }>;
};

function money(value: number | string, currency = "USD") {
  const numeric = typeof value === "number" ? value : Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(numeric);
}

function numberValue(value: string | number, digits = 4) {
  const numeric = typeof value === "number" ? value : Number(value || 0);
  return numeric.toFixed(digits);
}

function percentValue(value: string | number | null | undefined, digits = 2) {
  if (value === null || value === undefined || value === "") return "N/A";
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return "N/A";
  return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(digits)}%`;
}

function metricClass(value: string | number | null | undefined) {
  const numeric = typeof value === "number" ? value : Number(value || 0);
  if (numeric > 0) return "text-emerald-300";
  if (numeric < 0) return "text-rose-300";
  return "text-white/70";
}

function displayText(value: unknown, fallback = "N/A"): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "[object Object]") return fallback;
    if (trimmed.includes("authorization_types") || trimmed.includes("maintenance_windows")) return fallback;
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        return displayText(JSON.parse(trimmed), fallback);
      } catch {
        return fallback;
      }
    }
    return trimmed;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    const parts: string[] = value.map((item) => displayText(item, "")).filter(Boolean);
    return parts.join(", ") || fallback;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["name", "description", "label", "display_name", "symbol", "brokerage_name", "account_name", "type", "value"]) {
      const nested: string = displayText(record[key], "");
      if (nested) return nested;
    }
  }

  return fallback;
}

function safeCurrency(value: unknown) {
  const currency = displayText(value, "USD").toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : "USD";
}

function formatTime(value?: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

type ApiError = {
  response?: {
    data?: {
      error?: string;
    };
  };
  message?: string;
};

export default function InvestmentsPage() {
  const searchParams = useSearchParams();
  const completedConnectRef = useRef(false);
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [marketData, setMarketData] = useState<MarketSummaryResponse | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketRefreshing, setMarketRefreshing] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);

  const fetchSummary = async () => {
    try {
      setError(null);
      const response = await api.get<PortfolioResponse>("/investments/portfolio/summary/");
      setData(response.data);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError?.response?.data?.error || apiError?.message || "Failed to load investments.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchMarketSummary = async () => {
    try {
      setMarketError(null);
      const response = await api.get<MarketSummaryResponse>("/market/summary/");
      setMarketData(response.data);
    } catch (err) {
      const apiError = err as ApiError;
      setMarketError(apiError?.response?.data?.error || apiError?.message || "Failed to load market data.");
    } finally {
      setMarketLoading(false);
      setMarketRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchMarketSummary();
  }, []);

  useEffect(() => {
    const completeReturnedSnapTradeFlow = async () => {
      if (completedConnectRef.current) return;
      const returnedFromSnapTrade = searchParams.toString().length > 0 || (typeof window !== "undefined" && document.referrer.includes("snaptrade.com"));
      if (!returnedFromSnapTrade) return;

      completedConnectRef.current = true;
      try {
        setConnecting(true);
        setError(null);
        await api.post("/investments/snaptrade/callback/");
        await fetchSummary();
        if (typeof window !== "undefined") {
          window.history.replaceState({}, "", "/investments");
        }
      } catch (err) {
        const apiError = err as ApiError;
        setError(apiError?.response?.data?.error || apiError?.message || "Connected to SnapTrade, but failed to finalize the investment sync.");
      } finally {
        setConnecting(false);
      }
    };

    completeReturnedSnapTradeFlow();
  }, [searchParams]);

  const allHoldings = useMemo(() => {
    if (!data) return [] as Array<Holding & { accountName: string; currency: string }>;
    return data.accounts.flatMap((account) =>
      account.holdings.map((holding) => ({ ...holding, accountName: account.account_name, currency: account.currency }))
    );
  }, [data]);

  const completedOrders = useMemo(() => {
    if (!data) return [] as Array<Order & { accountName: string }>;
    return data.accounts
      .flatMap((account) => account.orders.map((order) => ({ ...order, accountName: account.account_name })))
      .filter((order) => displayText(order.status, "").toUpperCase() === "EXECUTED")
      .sort((a, b) => new Date(b.executed_at || b.placed_at || 0).getTime() - new Date(a.executed_at || a.placed_at || 0).getTime());
  }, [data]);

  const allocationRows = useMemo(() => {
    const totalValue = Number(data?.totals.portfolio_value || 0);
    const holdingValueBySymbol = allHoldings.reduce<Record<string, number>>((acc, holding) => {
      const symbol = displayText(holding.symbol, "").toUpperCase();
      if (!symbol) return acc;
      acc[symbol] = (acc[symbol] || 0) + Number(holding.market_value || 0);
      return acc;
    }, {});

    return (marketData?.symbols || []).map((item) => {
      const symbol = item.symbol.symbol;
      const currentWeight = totalValue > 0 ? ((holdingValueBySymbol[symbol] || 0) / totalValue) * 100 : 0;
      const targetWeight = Number(item.symbol.target_weight_percent || 0);
      return {
        symbol,
        currentWeight,
        targetWeight,
        drift: currentWeight - targetWeight,
        metrics: item.metrics,
        news: item.news || [],
      };
    });
  }, [allHoldings, data?.totals.portfolio_value, marketData]);

  const connectSnapTrade = async () => {
    try {
      setConnecting(true);
      setError(null);
      const redirectUri = typeof window !== "undefined" ? `${window.location.origin}/investments?snaptrade=return` : undefined;
      const response = await api.post("/investments/snaptrade/connect/", { redirect_uri: redirectUri });
      const loginLink = response.data?.login_link?.redirectURI || response.data?.login_link?.redirectUri || response.data?.login_link?.url;
      if (loginLink && typeof window !== "undefined") {
        window.location.href = loginLink;
        return;
      }
      await api.post("/investments/snaptrade/callback/");
      await fetchSummary();
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError?.response?.data?.error || apiError?.message || "Failed to start SnapTrade connection.");
    } finally {
      setConnecting(false);
    }
  };

  const refreshData = async () => {
    try {
      setRefreshing(true);
      setError(null);
      await api.post("/investments/snaptrade/refresh/");
      await fetchSummary();
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError?.response?.data?.error || apiError?.message || "Failed to refresh investment data.");
      setRefreshing(false);
    }
  };

  const refreshMarketData = async () => {
    try {
      setMarketRefreshing(true);
      setMarketError(null);
      await api.post("/market/refresh/", { symbols: ["QQQM", "SCHD", "VXUS", "VB"] });
      await fetchMarketSummary();
    } catch (err) {
      const apiError = err as ApiError;
      setMarketError(apiError?.response?.data?.error || apiError?.message || "Failed to refresh market data.");
      setMarketRefreshing(false);
    }
  };

  const connected = Boolean(data?.connected);
  const connectionLabel = connected ? displayText(data?.connection?.brokerage_name, "SnapTrade connected") : "Not connected";

  return (
    <div className="min-h-[81vh] w-full bg-[#121212] text-white font-sans pt-3 sm:pt-4 mb-20 px-3 sm:px-6 lg:pl-24 lg:pr-12 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Investments</h1>
          <p className="text-white/60 mt-1">
            Fidelity investment data lives here only. No brokerage activity is written into the transaction ledger.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {!connected ? (
            <Button onClick={connectSnapTrade} disabled={connecting} className="bg-white text-black hover:bg-white/85">
              <Shield className="h-4 w-4" />
              {connecting ? "Connecting..." : "Connect Fidelity via SnapTrade"}
            </Button>
          ) : (
            <Button onClick={refreshData} disabled={refreshing} className="bg-white text-black hover:bg-white/85">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing..." : "Refresh investments"}
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card className="bg-[#1c1c1c] border-white/10"><CardContent className="p-4"><p className="text-xs text-white/50 uppercase tracking-wide">Connection</p><div className="mt-2 flex items-center gap-2 text-sm">{connected ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <AlertCircle className="h-4 w-4 text-amber-400" />}<span>{connectionLabel}</span></div></CardContent></Card>
        <Card className="bg-[#1c1c1c] border-white/10"><CardContent className="p-4"><p className="text-xs text-white/50 uppercase tracking-wide">Portfolio Value</p><p className="text-2xl font-semibold mt-2">{money(data?.totals.portfolio_value || 0)}</p></CardContent></Card>
        <Card className="bg-[#1c1c1c] border-white/10"><CardContent className="p-4"><p className="text-xs text-white/50 uppercase tracking-wide">Cash Balance</p><p className="text-2xl font-semibold mt-2">{money(data?.totals.cash_balance || 0)}</p></CardContent></Card>
        <Card className="bg-[#1c1c1c] border-white/10"><CardContent className="p-4"><p className="text-xs text-white/50 uppercase tracking-wide">Buying Power</p><p className="text-2xl font-semibold mt-2">{money(data?.totals.buying_power || 0)}</p><p className="text-xs text-white/45 mt-2">Last sync: {formatTime(data?.as_of)}</p></CardContent></Card>
      </div>

      <div className="bg-[#1c1c1c] border border-white/10 rounded-lg overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3 className="h-4 w-4 text-sky-300" />
              ETF Market Plan
            </div>
            <p className="mt-1 text-xs text-white/45">Cached yfinance prices, metrics, target allocation, and recent news.</p>
          </div>
          <Button onClick={refreshMarketData} disabled={marketRefreshing} variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
            <RefreshCw className={`h-4 w-4 ${marketRefreshing ? "animate-spin" : ""}`} />
            {marketRefreshing ? "Refreshing market..." : "Refresh market"}
          </Button>
        </div>

        {marketError ? (
          <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{marketError}</span>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-4">
          {marketLoading ? (
            <div className="px-4 py-8 text-sm text-white/50 lg:col-span-4">Loading market data...</div>
          ) : allocationRows.length ? (
            allocationRows.map((row) => {
              const latestNews = row.news[0];
              return (
                <div key={row.symbol} className="border-b border-white/10 p-4 lg:border-b-0 lg:border-r last:border-r-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold">{row.symbol}</div>
                      <div className="text-xs text-white/45">As of {row.metrics?.as_of || "N/A"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">{row.metrics?.latest_close ? money(row.metrics.latest_close) : "N/A"}</div>
                      <div className={`text-xs ${metricClass(row.metrics?.return_1d_percent)}`}>{percentValue(row.metrics?.return_1d_percent)} 1D</div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-md bg-white/5 p-2">
                      <div className="text-white/40">5D</div>
                      <div className={metricClass(row.metrics?.return_5d_percent)}>{percentValue(row.metrics?.return_5d_percent)}</div>
                    </div>
                    <div className="rounded-md bg-white/5 p-2">
                      <div className="text-white/40">1M</div>
                      <div className={metricClass(row.metrics?.return_1m_percent)}>{percentValue(row.metrics?.return_1m_percent)}</div>
                    </div>
                    <div className="rounded-md bg-white/5 p-2">
                      <div className="text-white/40">RSI</div>
                      <div className="text-white/75">{row.metrics?.rsi_14 ? Number(row.metrics.rsi_14).toFixed(1) : "N/A"}</div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-white/55"><Target className="h-3.5 w-3.5" /> Target</span>
                      <span>{row.targetWeight.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-sky-300" style={{ width: `${Math.min(Math.max(row.targetWeight, 0), 100)}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-white/55"><Activity className="h-3.5 w-3.5" /> Current</span>
                      <span>{row.currentWeight.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-emerald-300" style={{ width: `${Math.min(Math.max(row.currentWeight, 0), 100)}%` }} />
                    </div>
                    <div className={`text-xs ${metricClass(row.drift)}`}>Drift: {percentValue(row.drift)}</div>
                  </div>

                  <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-medium text-white/65"><Newspaper className="h-3.5 w-3.5" /> Latest news</div>
                    {latestNews ? (
                      <a href={latestNews.url} target="_blank" rel="noreferrer" className="block text-sm text-white hover:text-sky-200">
                        <span className="line-clamp-2">{latestNews.title}</span>
                        <span className="mt-1 block text-xs text-white/40">{displayText(latestNews.publisher, "Yahoo Finance")}</span>
                      </a>
                    ) : (
                      <div className="text-sm text-white/45">No cached news yet.</div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-4 py-8 text-sm text-white/50 lg:col-span-4">No tracked ETF market data available yet.</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-[#1c1c1c] border border-white/10 rounded-lg overflow-hidden">
          <div className="px-4 py-3 text-sm font-semibold border-b border-white/10">Current Holdings</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-white/50 border-b border-white/10">
                <tr>
                  <th className="text-left px-4 py-3">Symbol</th>
                  <th className="text-left px-4 py-3">Account</th>
                  <th className="text-right px-4 py-3">Shares</th>
                  <th className="text-right px-4 py-3">Avg Cost</th>
                  <th className="text-right px-4 py-3">Current</th>
                  <th className="text-right px-4 py-3">Value</th>
                  <th className="text-right px-4 py-3">Weight</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="px-4 py-8 text-white/50" colSpan={7}>Loading investment data...</td></tr>
                ) : allHoldings.length === 0 ? (
                  <tr><td className="px-4 py-8 text-white/50" colSpan={7}>No holdings yet. Connect Fidelity via SnapTrade to populate this page.</td></tr>
                ) : (
                  allHoldings.map((holding) => (
                    <tr key={`${displayText(holding.accountName, "account")}-${displayText(holding.symbol, holding.id.toString())}`} className="border-b border-white/5">
                      <td className="px-4 py-3"><div className="font-medium">{displayText(holding.symbol, "Unknown")}</div><div className="text-xs text-white/45">{displayText(holding.name, "Unnamed holding")}</div></td>
                      <td className="px-4 py-3 text-white/70">{displayText(holding.accountName, "Investment Account")}</td>
                      <td className="px-4 py-3 text-right">{numberValue(holding.quantity, 4)}</td>
                      <td className="px-4 py-3 text-right">{money(holding.average_purchase_price, safeCurrency(holding.currency))}</td>
                      <td className="px-4 py-3 text-right">{money(holding.current_price, safeCurrency(holding.currency))}</td>
                      <td className="px-4 py-3 text-right">{money(holding.market_value, safeCurrency(holding.currency))}</td>
                      <td className="px-4 py-3 text-right">{Number(holding.weight_percent || 0).toFixed(2)}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[#1c1c1c] border border-white/10 rounded-lg overflow-hidden">
            <div className="px-4 py-3 text-sm font-semibold border-b border-white/10">Investment Accounts</div>
            <div className="divide-y divide-white/10">
              {loading ? (
                <div className="px-4 py-4 text-white/50 text-sm">Loading accounts...</div>
              ) : data?.accounts?.length ? (
                data.accounts.map((account) => (
                  <div key={account.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{displayText(account.account_name, "Investment Account")}</div>
                        <div className="text-sm text-white/60">{displayText(account.brokerage_name, "Fidelity")} • {displayText(account.account_type, "Brokerage")}</div>
                        <div className="text-xs text-white/40 mt-1">•••• {displayText(account.account_number_mask, "N/A")}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold">{money(account.total_value, safeCurrency(account.currency))}</div>
                        <div className="text-xs text-white/45">Updated {formatTime(account.last_synced_at)}</div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-white/70">
                      <div className="rounded-md bg-white/5 p-2">Cash: {money(account.cash_balance, safeCurrency(account.currency))}</div>
                      <div className="rounded-md bg-white/5 p-2">Buying power: {money(account.buying_power, safeCurrency(account.currency))}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-4 text-white/50 text-sm">No investment accounts connected yet.</div>
              )}
            </div>
          </div>

          <div className="bg-[#1c1c1c] border border-white/10 rounded-lg overflow-hidden">
            <div className="px-4 py-3 text-sm font-semibold border-b border-white/10 flex items-center gap-2"><Wallet className="h-4 w-4" /> Completed Orders</div>
            <div className="divide-y divide-white/10">
              {loading ? (
                <div className="px-4 py-4 text-white/50 text-sm">Loading orders...</div>
              ) : completedOrders.length ? (
                completedOrders.map((order) => (
                  <div key={order.provider_order_id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{displayText(order.symbol, "Order")}</div>
                        <div className="text-sm text-white/60">{displayText(order.side, "Unknown side")} • {displayText(order.status, "unknown")} • {displayText(order.accountName, "Investment Account")}</div>
                      </div>
                      <div className="text-right text-sm">
                        <div>{numberValue(order.filled_quantity || order.quantity, 4)} shares</div>
                        <div className="text-white/60">{money(order.average_filled_price)}</div>
                        <div className="text-white/45">{order.executed_at || order.placed_at ? new Date(order.executed_at || order.placed_at || "").toLocaleDateString() : "No time"}</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-4 text-white/50 text-sm">No completed orders available.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
