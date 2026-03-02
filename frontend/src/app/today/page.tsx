"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Loader2, RefreshCw, Wand2, Repeat2, CreditCard } from "lucide-react";

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

export default function TodayPage() {
  const { authTokens } = useAuth();
  const [overview, setOverview] = useState<TodayOverview | null>(null);
  const [optimizer, setOptimizer] = useState<PaymentOptimizer | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [lastActionResult, setLastActionResult] = useState<string>("");

  const refreshAll = async () => {
    if (!authTokens?.access) return;
    setLoading(true);
    try {
      const [o, p] = await Promise.all([
        apiFetch("/transactions/today_overview/", authTokens.access),
        apiFetch("/transactions/payment_optimizer/", authTokens.access),
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
  }, [authTokens?.access]);

  const uncategorizedTx = useMemo(
    () =>
      (overview?.today_transactions || []).filter(
        (t) => (t.category || "").toLowerCase() === "uncategorized"
      ),
    [overview]
  );

  const runReconcile = async () => {
    if (!authTokens?.access) return;
    setActionBusy("reconcile");
    try {
      const r = await apiFetch("/transactions/reconcile/", authTokens.access, "POST", {});
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
    if (!authTokens?.access) return;
    setActionBusy("transfer");
    try {
      const r = await apiFetch("/transactions/detect_transfers/", authTokens.access, "POST", {});
      setLastActionResult(`Transfer detection complete: ${r.matches_found || 0} matches.`);
      await refreshAll();
    } catch (e: any) {
      setLastActionResult(`Transfer detect failed: ${e.message}`);
    } finally {
      setActionBusy(null);
    }
  };

  const runCategorizeAsync = async () => {
    if (!authTokens?.access) return;
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
        authTokens.access,
        "POST",
        { descriptions, transaction_ids: ids, auto_update: true }
      );
      setLastActionResult(`Categorization queued (job ${start.job_id}). Polling...`);

      let status = "queued";
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const st = await apiFetch(
          `/transactions/categorize_jobs/?job_id=${start.job_id}`,
          authTokens.access
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
      <div className="text-white p-8 ml-24 mt-16 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading today view...
      </div>
    );
  }

  return (
    <div className="text-white p-8 ml-24 mt-16 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Today</h1>
        <button
          className="px-3 py-2 border border-[#2b2b2b] bg-[#1c1c1c] text-sm inline-flex items-center gap-2"
          onClick={refreshAll}
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#1c1c1c] border border-[#2b2b2b] p-4">Today Spend: ${overview?.today_spend ?? 0}</div>
        <div className="bg-[#1c1c1c] border border-[#2b2b2b] p-4">Today Income: ${overview?.today_income ?? 0}</div>
        <div className="bg-[#1c1c1c] border border-[#2b2b2b] p-4">Uncategorized: {overview?.uncategorized_count ?? 0}</div>
        <div className="bg-[#1c1c1c] border border-[#2b2b2b] p-4">Total CC Due: ${optimizer?.total_credit_card_due ?? 0}</div>
      </div>

      <div className="bg-[#1c1c1c] border border-[#2b2b2b] p-4 space-y-3">
        <h2 className="text-lg">Action Center</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={runCategorizeAsync}
            className="px-3 py-2 border border-[#2b2b2b] bg-[#121212] text-sm inline-flex items-center gap-2"
            disabled={!!actionBusy}
          >
            {actionBusy === "categorize" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Run AI Categorization
          </button>
          <button
            onClick={runTransferDetect}
            className="px-3 py-2 border border-[#2b2b2b] bg-[#121212] text-sm inline-flex items-center gap-2"
            disabled={!!actionBusy}
          >
            {actionBusy === "transfer" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Repeat2 className="h-4 w-4" />}
            Detect Transfers
          </button>
          <button
            onClick={runReconcile}
            className="px-3 py-2 border border-[#2b2b2b] bg-[#121212] text-sm inline-flex items-center gap-2"
            disabled={!!actionBusy}
          >
            {actionBusy === "reconcile" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            Run Reconcile
          </button>
        </div>
        {!!lastActionResult && <p className="text-sm text-white/80">{lastActionResult}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#1c1c1c] border border-[#2b2b2b] p-4">
          <h2 className="text-lg mb-3">Today's Transactions</h2>
          <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
            {(overview?.today_transactions || []).map((t) => (
              <div key={t.id} className="flex justify-between text-sm border-b border-[#2b2b2b] pb-2">
                <div>
                  <div>{t.name}</div>
                  <div className="text-white/60">
                    {t.merchant_canonical} • {t.category}
                  </div>
                </div>
                <div>{t.amount}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-[#1c1c1c] border border-[#2b2b2b] p-4">
            <h2 className="text-lg mb-3">Upcoming 7 Days</h2>
            <div className="space-y-2 max-h-[200px] overflow-auto">
              {(overview?.upcoming_7d || []).map((t) => (
                <div key={t.id} className="flex justify-between text-sm border-b border-[#2b2b2b] pb-2">
                  <div>
                    <div>{t.name}</div>
                    <div className="text-white/60">{t.date} • {t.category}</div>
                  </div>
                  <div>{t.amount}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#1c1c1c] border border-[#2b2b2b] p-4">
            <h2 className="text-lg mb-3">Card Payment Priorities</h2>
            <div className="space-y-2">
              {(optimizer?.cards || []).map((c) => (
                <div key={c.account_id} className="text-sm border-b border-[#2b2b2b] pb-2">
                  <div className="flex justify-between">
                    <span>{c.account_name}</span>
                    <span>${c.payable_now}</span>
                  </div>
                  <div className="text-white/60">Util: {c.estimated_utilization_pct}% • {c.priority.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
