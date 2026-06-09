"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, RefreshCw, Shield, Wallet } from "lucide-react";

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

  useEffect(() => {
    fetchSummary();
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
