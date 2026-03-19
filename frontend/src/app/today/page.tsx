"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Loader2,
  RefreshCw,
  Wand2,
  Repeat2,
  CreditCard,
  CalendarDays,
  Sparkles,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type TodayOverview = {
  date: string;
  today_spend: number;
  today_income: number;
  uncategorized_count: number;
  today_transactions: Array<{
    id: number;
    date: string;
    name: string;
    merchant_canonical: string;
    amount: string;
    category: string;
    is_transfer: boolean;
  }>;
  upcoming_7d: Array<{
    id: number;
    date: string;
    name: string;
    amount: string;
    category: string;
  }>;
};

type PaymentOptimizer = {
  total_credit_card_due: number;
  cards: Array<{
    account_id: number;
    account_name: string;
    payable_now: number;
    estimated_utilization_pct: number;
    priority: "high" | "medium" | "low";
    recommended_action: string;
  }>;
};

async function apiFetch(path: string, token?: string, method = "GET", body?: any) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || json?.detail || `Request failed (${res.status})`);
  return json;
}

function formatMoney(value: number | string) {
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export default function TodayPage() {
  const { tokens } = useAuth();
  const [overview, setOverview] = useState<TodayOverview | null>(null);
  const [optimizer, setOptimizer] = useState<PaymentOptimizer | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [lastActionResult, setLastActionResult] = useState<string>("");

  const refreshAll = async () => {
    if (!tokens?.access) return;
    setLoading(true);
    try {
      const [o, p] = await Promise.all([
        apiFetch("/transactions/today_overview/", tokens.access),
        apiFetch("/transactions/payment_optimizer/", tokens.access),
      ]);
      setOverview(o);
      setOptimizer(p);
    } catch (e: any) {
      setLastActionResult(`Refresh failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens?.access]);

  const uncategorizedTx = useMemo(
    () =>
      (overview?.today_transactions || []).filter(
        (t) => (t.category || "").toLowerCase() === "uncategorized"
      ),
    [overview]
  );

  const runReconcile = async () => {
    if (!tokens?.access) return;
    setActionBusy("reconcile");
    try {
      const r = await apiFetch("/transactions/reconcile/", tokens.access, "POST", {});
      setLastActionResult(
        `Reconcile complete: ${r.duplicates_marked || 0} duplicates, ${r.refunds_marked || 0} refunds tagged.`
      );
      await refreshAll();
    } catch (e: any) {
      setLastActionResult(`Reconcile failed: ${e.message}`);
    } finally {
      setActionBusy(null);
    }
  };

  const runTransferDetect = async () => {
    if (!tokens?.access) return;
    setActionBusy("transfer");
    try {
      const r = await apiFetch("/transactions/detect_transfers/", tokens.access, "POST", {});
      setLastActionResult(`Transfer detection complete: ${r.matches_found || 0} matches.`);
      await refreshAll();
    } catch (e: any) {
      setLastActionResult(`Transfer detect failed: ${e.message}`);
    } finally {
      setActionBusy(null);
    }
  };

  const runCategorizeAsync = async () => {
    if (!tokens?.access) return;
    setActionBusy("categorize");
    try {
      const ids = uncategorizedTx.map((t) => t.id);
      const descriptions = uncategorizedTx.map((t) => t.name).filter(Boolean);
      if (!ids.length || !descriptions.length) {
        setLastActionResult("No uncategorized transactions in today list.");
        return;
      }
      const start = await apiFetch(
        "/transactions/categorize_with_ai_async/",
        tokens.access,
        "POST",
        { descriptions, transaction_ids: ids, auto_update: true }
      );
      setLastActionResult(`Categorization queued (job ${start.job_id}). Polling...`);

      let status = "queued";
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const st = await apiFetch(
          `/transactions/categorize_jobs/?job_id=${start.job_id}`,
          tokens.access
        );
        status = st.status;
        if (status === "done") {
          const updated = st?.result?.updated_count ?? 0;
          setLastActionResult(`Categorization complete: ${updated} updated.`);
          break;
        }
        if (status === "failed") {
          setLastActionResult(`Categorization failed: ${st.error || "unknown error"}`);
          break;
        }
      }
      if (status !== "done" && status !== "failed") {
        setLastActionResult("Categorization still running in background.");
      }
      await refreshAll();
    } catch (e: any) {
      setLastActionResult(`Categorization failed: ${e.message}`);
    } finally {
      setActionBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto mt-16 flex min-h-[40vh] w-full max-w-7xl items-center gap-2 px-4 text-white sm:px-6 lg:ml-24 lg:px-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading today view...
      </div>
    );
  }

  return (
    <div className="mx-auto mt-14 mb-12 w-full max-w-7xl space-y-5 px-4 text-white sm:px-6 lg:ml-24 lg:mt-16 lg:px-8">
      <div className="flex flex-col gap-3 rounded-xl border border-[#2b2b2b] bg-[#1a1a1a] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Today</h1>
          <p className="text-sm text-white/60">Your daily financial pulse and smart actions.</p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#2f2f2f] bg-[#101010] px-3 py-2 text-sm hover:bg-[#161616]"
          onClick={refreshAll}
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-[#2b2b2b] bg-[#1c1c1c] p-4">
          <p className="text-xs text-white/60">Today Spend</p>
          <p className="mt-1 text-lg font-semibold">{formatMoney(overview?.today_spend ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-[#2b2b2b] bg-[#1c1c1c] p-4">
          <p className="text-xs text-white/60">Today Income</p>
          <p className="mt-1 text-lg font-semibold">{formatMoney(overview?.today_income ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-[#2b2b2b] bg-[#1c1c1c] p-4">
          <p className="text-xs text-white/60">Uncategorized</p>
          <p className="mt-1 text-lg font-semibold">{overview?.uncategorized_count ?? 0}</p>
        </div>
        <div className="rounded-xl border border-[#2b2b2b] bg-[#1c1c1c] p-4">
          <p className="text-xs text-white/60">Total CC Due</p>
          <p className="mt-1 text-lg font-semibold">{formatMoney(optimizer?.total_credit_card_due ?? 0)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-[#2b2b2b] bg-[#1c1c1c] p-4 sm:p-5">
        <h2 className="mb-3 text-lg font-medium">Action Center</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <button
            onClick={runCategorizeAsync}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#2f2f2f] bg-[#121212] px-3 py-2 text-sm hover:bg-[#171717]"
            disabled={!!actionBusy}
          >
            {actionBusy === "categorize" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Run AI Categorization
          </button>
          <button
            onClick={runTransferDetect}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#2f2f2f] bg-[#121212] px-3 py-2 text-sm hover:bg-[#171717]"
            disabled={!!actionBusy}
          >
            {actionBusy === "transfer" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Repeat2 className="h-4 w-4" />}
            Detect Transfers
          </button>
          <button
            onClick={runReconcile}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#2f2f2f] bg-[#121212] px-3 py-2 text-sm hover:bg-[#171717]"
            disabled={!!actionBusy}
          >
            {actionBusy === "reconcile" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            Run Reconcile
          </button>
        </div>
        {!!lastActionResult && (
          <p className="mt-3 flex items-center gap-2 rounded-md border border-[#2b2b2b] bg-[#161616] px-3 py-2 text-sm text-white/80">
            <Sparkles className="h-4 w-4 text-white/70" />
            {lastActionResult}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-[#2b2b2b] bg-[#1c1c1c] p-4 sm:p-5">
          <h2 className="mb-3 text-lg font-medium">Today&apos;s Transactions</h2>
          <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
            {(overview?.today_transactions || []).map((t) => (
              <article key={t.id} className="rounded-lg border border-[#2b2b2b] bg-[#171717] p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-white/60">{t.merchant_canonical} • {t.category}</p>
                  </div>
                  <p className="shrink-0 font-medium">{formatMoney(t.amount)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-xl border border-[#2b2b2b] bg-[#1c1c1c] p-4 sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-medium">
              <CalendarDays className="h-4 w-4 text-white/70" />
              Upcoming 7 Days
            </h2>
            <div className="space-y-2 max-h-[220px] overflow-auto">
              {(overview?.upcoming_7d || []).map((t) => (
                <article key={t.id} className="rounded-lg border border-[#2b2b2b] bg-[#171717] p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-white/60">{t.date} • {t.category}</p>
                    </div>
                    <p className="shrink-0 font-medium">{formatMoney(t.amount)}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-[#2b2b2b] bg-[#1c1c1c] p-4 sm:p-5">
            <h2 className="mb-3 text-lg font-medium">Card Payment Priorities</h2>
            <div className="space-y-2">
              {(optimizer?.cards || []).map((c) => (
                <article key={c.account_id} className="rounded-lg border border-[#2b2b2b] bg-[#171717] p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{c.account_name}</span>
                    <span className="font-medium">{formatMoney(c.payable_now)}</span>
                  </div>
                  <div className="mt-1 text-white/60">
                    Util: {c.estimated_utilization_pct}% • {c.priority.toUpperCase()}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
