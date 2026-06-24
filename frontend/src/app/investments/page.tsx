"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Activity, AlertCircle, BarChart3, Bitcoin, CheckCircle2, ChevronLeft, ChevronRight, Newspaper, RefreshCw, Shield, Target, Wallet } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
  crypto_connected: boolean;
  connection: Connection | null;
  crypto_connection: Connection | null;
  accounts: InvestmentAccount[];
  totals: {
    portfolio_value: number;
    cash_balance: number;
    buying_power: number;
    cash_equivalents: number;
    available_to_invest: number;
    account_count: number;
  };
  as_of: string | null;
};

type KrakenLedgerEntry = {
  id: number;
  ledger_id: string;
  ref_id: string;
  entry_type: string;
  subtype: string;
  asset: string;
  amount: string;
  fee: string;
  balance: string;
  timestamp: string | null;
};

type KrakenLedgerResponse = {
  ledger: KrakenLedgerEntry[];
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

type MarketHistoryResponse = {
  history: Array<{
    symbol: string;
    date: string;
    open: string | null;
    high: string | null;
    low: string | null;
    close: string | null;
    volume: number | null;
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

const CASH_EQUIVALENT_SYMBOLS = new Set(["SPAXX", "FDRXX", "FZFXX", "FDLXX", "SPRXX", "FCASH", "CASH"]);

function isCashEquivalent(symbol: string) {
  return CASH_EQUIVALENT_SYMBOLS.has(displayText(symbol, "").toUpperCase());
}

function isCryptoAccount(account: Pick<InvestmentAccount, "brokerage_name" | "account_type">) {
  const brokerage = displayText(account.brokerage_name, "").toUpperCase();
  const accountType = displayText(account.account_type, "").toLowerCase();
  return brokerage === "KRAKEN" || accountType.includes("crypto");
}

function orderValue(order: Order) {
  const quantity = Number(order.filled_quantity || order.quantity || 0);
  const price = Number(order.average_filled_price || 0);
  return Math.abs(quantity * price);
}

function shortDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function signedNumber(value: string | number, digits = 8) {
  const numeric = typeof value === "number" ? value : Number(value || 0);
  if (!Number.isFinite(numeric)) return "0";
  return `${numeric > 0 ? "+" : ""}${numeric.toFixed(digits)}`;
}

export default function InvestmentsPage() {
  const searchParams = useSearchParams();
  const completedConnectRef = useRef(false);
  const completedOrderPageSize = 5;
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [completedOrderPage, setCompletedOrderPage] = useState(1);
  const [marketData, setMarketData] = useState<MarketSummaryResponse | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketRefreshing, setMarketRefreshing] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [krakenLedger, setKrakenLedger] = useState<KrakenLedgerEntry[]>([]);
  const [cryptoRefreshing, setCryptoRefreshing] = useState(false);
  const [btcHistory, setBtcHistory] = useState<MarketHistoryResponse["history"]>([]);

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

  const fetchKrakenLedger = async () => {
    try {
      const response = await api.get<KrakenLedgerResponse>("/investments/kraken/ledger/?limit=100");
      setKrakenLedger(response.data.ledger || []);
    } catch {
      setKrakenLedger([]);
    }
  };

  const fetchBtcHistory = async () => {
    try {
      const response = await api.get<MarketHistoryResponse>("/market/symbols/BTC-USD/history/?limit=180");
      setBtcHistory((response.data.history || []).slice().reverse());
    } catch {
      setBtcHistory([]);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchMarketSummary();
    fetchKrakenLedger();
    fetchBtcHistory();
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

  const stockAccounts = useMemo(() => (data?.accounts || []).filter((account) => !isCryptoAccount(account)), [data]);
  const cryptoAccounts = useMemo(() => (data?.accounts || []).filter(isCryptoAccount), [data]);

  const allHoldings = useMemo(() => {
    if (!data) return [] as Array<Holding & { accountName: string; currency: string; brokerageName: string; accountType: string }>;
    return data.accounts.flatMap((account) =>
      account.holdings.map((holding) => ({
        ...holding,
        accountName: account.account_name,
        currency: account.currency,
        brokerageName: account.brokerage_name,
        accountType: account.account_type,
      }))
    );
  }, [data]);

  const stockHoldings = useMemo(() => allHoldings.filter((holding) => !isCryptoAccount({
    brokerage_name: holding.brokerageName,
    account_type: holding.accountType,
  })), [allHoldings]);

  const investedStockHoldings = useMemo(
    () => stockHoldings.filter((holding) => !isCashEquivalent(displayText(holding.symbol, ""))),
    [stockHoldings]
  );

  const cryptoHoldings = useMemo(() => allHoldings.filter((holding) => isCryptoAccount({
    brokerage_name: holding.brokerageName,
    account_type: holding.accountType,
  })), [allHoldings]);

  const completedOrders = useMemo(() => {
    if (!data) return [] as Array<Order & { accountName: string; brokerageName: string; accountType: string }>;
    return data.accounts
      .flatMap((account) => account.orders.map((order) => ({
        ...order,
        accountName: account.account_name,
        brokerageName: account.brokerage_name,
        accountType: account.account_type,
      })))
      .filter((order) => displayText(order.status, "").toUpperCase() === "EXECUTED")
      .sort((a, b) => new Date(b.executed_at || b.placed_at || 0).getTime() - new Date(a.executed_at || a.placed_at || 0).getTime());
  }, [data]);

  const completedStockOrders = useMemo(() => completedOrders.filter((order) => !isCryptoAccount({
    brokerage_name: order.brokerageName,
    account_type: order.accountType,
  })), [completedOrders]);

  const completedOrderPageCount = Math.max(1, Math.ceil(completedStockOrders.length / completedOrderPageSize));
  const currentCompletedOrderPage = Math.min(completedOrderPage, completedOrderPageCount);
  const pagedCompletedOrders = useMemo(() => {
    const start = (currentCompletedOrderPage - 1) * completedOrderPageSize;
    return completedStockOrders.slice(start, start + completedOrderPageSize);
  }, [completedStockOrders, currentCompletedOrderPage]);

  const investmentPerformance = useMemo(() => {
    const sortedOrders = [...completedStockOrders].sort(
      (a, b) => new Date(a.executed_at || a.placed_at || 0).getTime() - new Date(b.executed_at || b.placed_at || 0).getTime()
    );
    const byDate = new Map<string, { date: string; contributed: number; deployed: number }>();
    let contributed = 0;
    let deployed = 0;

    sortedOrders.forEach((order) => {
      const symbol = displayText(order.symbol, "").toUpperCase();
      const side = displayText(order.side, "").toUpperCase();
      const amount = orderValue(order);
      const executedAt = order.executed_at || order.placed_at;
      if (!executedAt || amount <= 0) return;

      if (side === "BUY" && isCashEquivalent(symbol)) {
        contributed += amount;
      } else if (side === "BUY") {
        deployed += amount;
      } else if (side === "SELL" && !isCashEquivalent(symbol)) {
        deployed = Math.max(0, deployed - amount);
      }

      const date = new Date(executedAt).toISOString().slice(0, 10);
      byDate.set(date, { date, contributed, deployed });
    });

    const chartData = Array.from(byDate.values());
    const holdingsCost = investedStockHoldings.reduce((sum, holding) => sum + Number(holding.cost_basis || 0), 0);
    const holdingsValue = investedStockHoldings.reduce((sum, holding) => sum + Number(holding.market_value || 0), 0);
    const unrealizedGain = holdingsValue - holdingsCost;
    const unrealizedGainPercent = holdingsCost > 0 ? (unrealizedGain / holdingsCost) * 100 : 0;

    return {
      chartData,
      contributed,
      deployed,
      holdingsCost,
      holdingsValue,
      unrealizedGain,
      unrealizedGainPercent,
    };
  }, [investedStockHoldings, completedStockOrders]);

  useEffect(() => {
    setCompletedOrderPage(1);
  }, [completedStockOrders.length]);

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

  const refreshCryptoData = async () => {
    try {
      setCryptoRefreshing(true);
      setError(null);
      await api.post("/investments/kraken/refresh/");
      await api.post("/market/refresh/", { symbols: ["BTC-USD"] });
      await fetchSummary();
      await fetchKrakenLedger();
      await fetchBtcHistory();
      await fetchMarketSummary();
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError?.response?.data?.error || apiError?.message || "Failed to refresh Kraken BTC data.");
    } finally {
      setCryptoRefreshing(false);
    }
  };

  const refreshMarketData = async () => {
    try {
      setMarketRefreshing(true);
      setMarketError(null);
      await api.post("/market/refresh/", { symbols: ["SCHG", "SCHD", "VXUS", "VB", "BTC-USD"] });
      await fetchMarketSummary();
      await fetchBtcHistory();
    } catch (err) {
      const apiError = err as ApiError;
      setMarketError(apiError?.response?.data?.error || apiError?.message || "Failed to refresh market data.");
      setMarketRefreshing(false);
    }
  };

  const connected = Boolean(data?.connected);
  const cryptoConnected = Boolean(data?.crypto_connected);
  const connectionLabel = connected ? displayText(data?.connection?.brokerage_name, "SnapTrade connected") : "Not connected";
  const cryptoConnectionLabel = cryptoConnected ? displayText(data?.crypto_connection?.brokerage_name, "Kraken connected") : "Not synced";
  const stockPortfolioValue = stockAccounts.reduce((sum, account) => sum + Number(account.total_value || 0), 0);
  const stockCashBalance = stockAccounts.reduce((sum, account) => sum + Number(account.cash_balance || 0), 0);
  const stockBuyingPower = stockAccounts.reduce((sum, account) => sum + Number(account.buying_power || 0), 0);
  const rawStockCashEquivalents = stockHoldings
    .filter((holding) => isCashEquivalent(displayText(holding.symbol, "")))
    .reduce((sum, holding) => sum + Number(holding.market_value || 0), 0);
  const stockCashEquivalents = Math.min(rawStockCashEquivalents, Number(data?.totals.cash_equivalents || 0));
  const stockAvailableToInvest = Math.max(stockBuyingPower, stockCashBalance + stockCashEquivalents);
  const cryptoPortfolioValue = cryptoAccounts.reduce((sum, account) => sum + Number(account.total_value || 0), 0);
  const krakenCashBalance = cryptoAccounts.reduce((sum, account) => sum + Number(account.cash_balance || 0), 0);
  const btcHolding = cryptoHoldings.find((holding) => displayText(holding.symbol, "").toUpperCase() === "BTC-USD");
  const btcMarketValue = Number(btcHolding?.market_value || 0);
  const latestStockSync = stockAccounts.map((account) => account.last_synced_at).filter(Boolean).sort().at(-1) || null;
  const latestCryptoSync = cryptoAccounts.map((account) => account.last_synced_at).filter(Boolean).sort().at(-1) || null;
  const btcMetrics = allocationRows.find((row) => row.symbol === "BTC-USD")?.metrics || null;

  return (
    <div className="flex min-h-[81vh] w-full flex-col gap-6 bg-[#121212] text-white font-sans pt-3 sm:pt-4 mb-20 px-3 sm:px-6 lg:pl-24 lg:pr-12">
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
          <Button onClick={refreshCryptoData} disabled={cryptoRefreshing} variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
            <Bitcoin className={`h-4 w-4 ${cryptoRefreshing ? "animate-pulse" : ""}`} />
            {cryptoRefreshing ? "Syncing BTC..." : "Sync Kraken BTC"}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        <Card className="bg-[#1c1c1c] border-white/10"><CardContent className="p-4"><p className="text-xs text-white/50 uppercase tracking-wide">Connections</p><div className="mt-2 flex items-center gap-2 text-sm">{connected ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <AlertCircle className="h-4 w-4 text-amber-400" />}<span>{connectionLabel}</span></div><div className="mt-1 flex items-center gap-2 text-sm">{cryptoConnected ? <CheckCircle2 className="h-4 w-4 text-orange-300" /> : <AlertCircle className="h-4 w-4 text-white/35" />}<span>{cryptoConnectionLabel}</span></div></CardContent></Card>
        <Card className="bg-[#1c1c1c] border-white/10"><CardContent className="p-4"><p className="text-xs text-white/50 uppercase tracking-wide">Total Portfolio</p><p className="text-2xl font-semibold mt-2">{money(data?.totals.portfolio_value || 0)}</p><p className="mt-2 text-xs text-white/45">Stocks + Kraken, display split below</p></CardContent></Card>
        <Card className="bg-[#142018] border-emerald-400/20"><CardContent className="p-4"><p className="text-xs text-emerald-100/60 uppercase tracking-wide">Stock Cash</p><p className="text-2xl font-semibold mt-2">{money(stockAvailableToInvest)}</p><p className="text-xs text-emerald-100/45 mt-2">SPAXX/MMF: {money(stockCashEquivalents)}</p><p className="text-xs text-emerald-100/45 mt-1">Fidelity value: {money(stockPortfolioValue)}</p></CardContent></Card>
        <Card className="bg-[#24180f] border-orange-300/25"><CardContent className="p-4"><p className="text-xs text-orange-100/60 uppercase tracking-wide">Kraken Cash</p><p className="text-2xl font-semibold mt-2">{money(krakenCashBalance)}</p><p className="text-xs text-orange-100/45 mt-2">Crypto account value: {money(cryptoPortfolioValue)}</p><p className="text-xs text-orange-100/45 mt-1">Last sync: {formatTime(latestCryptoSync)}</p></CardContent></Card>
        <Card className="bg-[#1c1c1c] border-white/10"><CardContent className="p-4"><p className="text-xs text-white/50 uppercase tracking-wide">BTC Position</p><p className="text-2xl font-semibold mt-2">{money(btcMarketValue)}</p><p className="text-xs text-white/45 mt-2">{btcHolding ? numberValue(btcHolding.quantity, 8) : "0.00000000"} BTC</p><p className="text-xs text-white/45 mt-1">Stocks sync: {formatTime(latestStockSync)}</p></CardContent></Card>
      </div>

      <div className="order-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="bg-[#1c1c1c] border border-white/10 rounded-lg overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-white/10 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Bitcoin className="h-4 w-4 text-orange-300" />
              BTC Price History
            </div>
            <div className={`text-sm font-medium ${metricClass(btcMetrics?.return_1d_percent)}`}>
              {btcMetrics?.latest_close ? money(btcMetrics.latest_close) : "No cached price"} • {percentValue(btcMetrics?.return_1d_percent)} 1D
            </div>
          </div>
          <div className="h-[280px] px-3 py-4">
            {btcHistory.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={btcHistory} margin={{ top: 12, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} minTickGap={18} />
                  <YAxis stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} tickFormatter={(value) => `$${Number(value).toFixed(0)}`} width={70} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ background: "#171717", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff" }}
                    labelFormatter={(value) => formatTime(String(value))}
                    formatter={(value: number | string) => [money(Number(value)), "BTC close"]}
                  />
                  <Line type="monotone" dataKey="close" name="close" stroke="#fb923c" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-white/45">Refresh BTC market data to populate the chart.</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-[#1c1c1c] border-white/10"><CardContent className="p-4"><p className="text-xs text-white/50 uppercase tracking-wide">BTC Balance</p><p className="mt-2 text-2xl font-semibold">{btcHolding ? numberValue(btcHolding.quantity, 8) : "0.00000000"}</p></CardContent></Card>
          <Card className="bg-[#1c1c1c] border-white/10"><CardContent className="p-4"><p className="text-xs text-white/50 uppercase tracking-wide">BTC Value</p><p className="mt-2 text-2xl font-semibold">{money(btcHolding?.market_value || 0)}</p></CardContent></Card>
          <Card className="bg-[#1c1c1c] border-white/10"><CardContent className="p-4"><p className="text-xs text-white/50 uppercase tracking-wide">Avg Cost</p><p className="mt-2 text-2xl font-semibold">{money(btcHolding?.average_purchase_price || 0)}</p></CardContent></Card>
          <Card className="bg-[#1c1c1c] border-white/10"><CardContent className="p-4"><p className="text-xs text-white/50 uppercase tracking-wide">Target Weight</p><p className="mt-2 text-2xl font-semibold">10.0%</p><p className="mt-1 text-xs text-white/45">Current: {btcHolding ? `${Number(btcHolding.weight_percent || 0).toFixed(2)}%` : "0.00%"}</p></CardContent></Card>
        </div>
      </div>

      <div className="order-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="bg-[#1c1c1c] border border-white/10 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3 className="h-4 w-4 text-emerald-300" />
              Investment Growth
            </div>
            <div className={`text-sm font-medium ${investmentPerformance.unrealizedGain >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
              {money(investmentPerformance.unrealizedGain)} ({percentValue(investmentPerformance.unrealizedGainPercent)})
            </div>
          </div>
          <div className="h-[260px] px-3 py-4">
            {investmentPerformance.chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={investmentPerformance.chartData} margin={{ top: 12, right: 16, left: 4, bottom: 4 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} minTickGap={18} />
                  <YAxis stroke="rgba(255,255,255,0.45)" tickLine={false} axisLine={false} tickFormatter={(value) => `$${Number(value).toFixed(0)}`} width={58} />
                  <Tooltip
                    contentStyle={{ background: "#171717", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff" }}
                    labelFormatter={(value) => formatTime(String(value))}
                    formatter={(value: number | string, name: string) => [money(Number(value)), name === "contributed" ? "Capital Added" : "Capital Deployed"]}
                  />
                  <Line type="monotone" dataKey="contributed" name="contributed" stroke="#38bdf8" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="deployed" name="deployed" stroke="#34d399" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-white/45">No completed investment orders yet.</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
          <Card className="bg-[#1c1c1c] border-white/10"><CardContent className="p-4"><p className="text-xs text-white/50 uppercase tracking-wide">Capital Added</p><p className="mt-2 text-2xl font-semibold">{money(investmentPerformance.contributed)}</p></CardContent></Card>
          <Card className="bg-[#1c1c1c] border-white/10"><CardContent className="p-4"><p className="text-xs text-white/50 uppercase tracking-wide">Capital Deployed</p><p className="mt-2 text-2xl font-semibold">{money(investmentPerformance.deployed)}</p></CardContent></Card>
          <Card className="bg-[#1c1c1c] border-white/10"><CardContent className="p-4"><p className="text-xs text-white/50 uppercase tracking-wide">Holding Cost</p><p className="mt-2 text-2xl font-semibold">{money(investmentPerformance.holdingsCost)}</p></CardContent></Card>
          <Card className="bg-[#1c1c1c] border-white/10"><CardContent className="p-4"><p className="text-xs text-white/50 uppercase tracking-wide">Holding Value</p><p className="mt-2 text-2xl font-semibold">{money(investmentPerformance.holdingsValue)}</p></CardContent></Card>
        </div>
      </div>

      <div className="order-7 bg-[#1c1c1c] border border-white/10 rounded-lg overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3 className="h-4 w-4 text-sky-300" />
              ETF + BTC Market Plan
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

      <div className="order-4 grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-[#1c1c1c] border border-white/10 rounded-lg overflow-hidden">
          <div className="px-4 py-3 text-sm font-semibold border-b border-white/10">Stock Holdings</div>
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
                ) : investedStockHoldings.length === 0 ? (
                  <tr><td className="px-4 py-8 text-white/50" colSpan={7}>No stock holdings yet. Connect Fidelity via SnapTrade to populate this table.</td></tr>
                ) : (
                  investedStockHoldings.map((holding) => (
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
            <div className="px-4 py-3 text-sm font-semibold border-b border-white/10">Accounts by Source</div>
            <div className="divide-y divide-white/10">
              {loading ? (
                <div className="px-4 py-4 text-white/50 text-sm">Loading accounts...</div>
              ) : data?.accounts?.length ? (
                data.accounts.map((account) => (
                  <div key={account.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{displayText(account.account_name, "Investment Account")}</div>
                        <div className={`text-sm ${isCryptoAccount(account) ? "text-orange-200/70" : "text-emerald-100/70"}`}>{displayText(account.brokerage_name, "Fidelity")} • {displayText(account.account_type, "Brokerage")}</div>
                        <div className="text-xs text-white/40 mt-1">•••• {displayText(account.account_number_mask, "N/A")}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold">{money(account.total_value, safeCurrency(account.currency))}</div>
                        <div className="text-xs text-white/45">Updated {formatTime(account.last_synced_at)}</div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-white/70">
                      <div className="rounded-md bg-white/5 p-2">{isCryptoAccount(account) ? "Kraken cash" : "Stock cash"}: {money(account.cash_balance, safeCurrency(account.currency))}</div>
                      <div className="rounded-md bg-white/5 p-2">{isCryptoAccount(account) ? "Crypto buying power" : "Brokerage buying power"}: {money(account.buying_power, safeCurrency(account.currency))}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-4 text-white/50 text-sm">No investment accounts connected yet.</div>
              )}
            </div>
          </div>

          <div className="bg-[#1c1c1c] border border-white/10 rounded-lg overflow-hidden">
            <div className="px-4 py-3 text-sm font-semibold border-b border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><Wallet className="h-4 w-4" /> Completed Stock Orders</div>
              {completedStockOrders.length > 0 ? (
                <span className="text-xs font-normal text-white/45">{completedStockOrders.length} total</span>
              ) : null}
            </div>
            <div className="divide-y divide-white/10">
              {loading ? (
                <div className="px-4 py-4 text-white/50 text-sm">Loading orders...</div>
              ) : completedStockOrders.length ? (
                <>
                  {pagedCompletedOrders.map((order) => (
                    <div key={order.provider_order_id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{displayText(order.symbol, "Order")}</div>
                          <div className="text-sm text-white/60">{displayText(order.side, "Unknown side")} • {displayText(order.status, "unknown")} • {displayText(order.accountName, "Investment Account")}</div>
                        </div>
                        <div className="text-right text-sm">
                          <div>{numberValue(order.filled_quantity || order.quantity, displayText(order.symbol, "").toUpperCase() === "BTC-USD" ? 8 : 4)} units</div>
                          <div className="text-white/60">{money(order.average_filled_price)}</div>
                          <div className="text-white/45">{order.executed_at || order.placed_at ? new Date(order.executed_at || order.placed_at || "").toLocaleDateString() : "No time"}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="text-xs text-white/45">
                      Page {currentCompletedOrderPage} of {completedOrderPageCount}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={currentCompletedOrderPage <= 1}
                        onClick={() => setCompletedOrderPage((page) => Math.max(1, page - 1))}
                        className="h-8 border-white/15 bg-white/5 px-2 text-white hover:bg-white/10 disabled:opacity-40"
                        aria-label="Previous completed orders page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={currentCompletedOrderPage >= completedOrderPageCount}
                        onClick={() => setCompletedOrderPage((page) => Math.min(completedOrderPageCount, page + 1))}
                        className="h-8 border-white/15 bg-white/5 px-2 text-white hover:bg-white/10 disabled:opacity-40"
                        aria-label="Next completed orders page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="px-4 py-4 text-white/50 text-sm">No completed orders available.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="order-8 bg-[#1c1c1c] border border-white/10 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Bitcoin className="h-4 w-4 text-orange-300" />
            Kraken Ledger
          </div>
          <span className="text-xs text-white/45">{krakenLedger.length} latest entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 text-white/50">
              <tr>
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Asset</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Fee</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-left">Reference</th>
              </tr>
            </thead>
            <tbody>
              {krakenLedger.length ? (
                krakenLedger.map((entry) => {
                  const amount = Number(entry.amount || 0);
                  return (
                    <tr key={entry.ledger_id} className="border-b border-white/5">
                      <td className="px-4 py-3 text-white/70">{formatTime(entry.timestamp)}</td>
                      <td className="px-4 py-3"><div className="font-medium">{displayText(entry.entry_type, "entry")}</div><div className="text-xs text-white/45">{displayText(entry.subtype, "")}</div></td>
                      <td className="px-4 py-3 text-white/70">{displayText(entry.asset, "N/A")}</td>
                      <td className={`px-4 py-3 text-right ${amount >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{signedNumber(entry.amount, entry.asset === "USD" ? 2 : 8)}</td>
                      <td className="px-4 py-3 text-right text-white/70">{signedNumber(entry.fee, entry.asset === "USD" ? 2 : 8)}</td>
                      <td className="px-4 py-3 text-right text-white/70">{Number(entry.balance || 0).toFixed(entry.asset === "USD" ? 2 : 8)}</td>
                      <td className="px-4 py-3 text-white/45">{displayText(entry.ref_id || entry.ledger_id, "N/A")}</td>
                    </tr>
                  );
                })
              ) : (
                <tr><td className="px-4 py-8 text-white/50" colSpan={7}>No Kraken ledger entries synced yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
