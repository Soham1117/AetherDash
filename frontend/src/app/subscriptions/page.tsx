"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import {
  Loader2,
  RefreshCw,
  CalendarDays,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Ban,
  Trash2,
  Edit2,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface Insight {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: "warning" | "high";
  metric: string;
}

interface Subscription {
  id: number;
  name: string;
  amount: number;
  frequency: string;
  status: "active" | "overdue" | "cancelled" | "discontinued";
  next_due_date: string;
  merchant_name: string;
  category_name: string;
  days_until_due?: number;
}

export default function SubscriptionsPage() {
  const { tokens } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);

  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const fetchSubscriptions = async () => {
    if (!tokens?.access) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/recurring_transactions/`, {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      if (res.ok) {
        const data = await res.json();
        const withDays = data.map((sub: Subscription) => ({
          ...sub,
          days_until_due: sub.next_due_date
            ? Math.ceil(
                (new Date(sub.next_due_date).getTime() - new Date().getTime()) /
                  (1000 * 3600 * 24)
              )
            : 999,
        }));
        setSubscriptions(withDays);
      }
    } catch (error) {
      console.error("Failed to fetch subscriptions", error);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    if (!tokens?.access) return;
    try {
      setScanning(true);
      const res = await fetch(`${API_URL}/recurring_transactions/scan/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      if (res.ok) {
        await res.json();
        fetchSubscriptions();
      }
    } catch (error) {
      console.error("Scan failed", error);
    } finally {
      setScanning(false);
    }
  };

  const fetchInsights = async () => {
    if (!tokens?.access) return;
    try {
      const res = await fetch(`${API_URL}/recurring_transactions/insights/`, {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      if (res.ok) setInsights(await res.json());
    } catch (e) {
      console.error("Failed to fetch insights", e);
    }
  };

  const handleDelete = async (id: number) => {
    if (!tokens?.access) return;
    try {
      const res = await fetch(`${API_URL}/recurring_transactions/${id}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      if (res.ok) {
        setSubscriptions((prev) => prev.filter((s) => s.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete subscription", error);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokens?.access || !editingSub) return;
    try {
      const res = await fetch(`${API_URL}/recurring_transactions/${editingSub.id}/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${tokens.access}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editingSub.name,
          amount: editingSub.amount,
          frequency: editingSub.frequency,
          status: editingSub.status,
          merchant_name: editingSub.merchant_name,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSubscriptions((prev) =>
          prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))
        );
        setIsEditOpen(false);
        setEditingSub(null);
      }
    } catch (error) {
      console.error("Failed to update subscription", error);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
    fetchInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens]);

  const activeSubs = useMemo(
    () => subscriptions.filter((s) => s.status === "active" || s.status === "overdue"),
    [subscriptions]
  );

  const monthlyBurn = useMemo(
    () =>
      activeSubs.reduce((sum, sub) => {
        let monthlyAmount = parseFloat(sub.amount.toString());
        if (sub.frequency === "yearly") monthlyAmount /= 12;
        if (sub.frequency === "weekly") monthlyAmount *= 4.33;
        return sum + monthlyAmount;
      }, 0),
    [activeSubs]
  );

  const yearlyBurn = monthlyBurn * 12;

  const sortedSubscriptions = useMemo(
    () =>
      [...subscriptions].sort((a, b) => {
        if (a.status === "active" && b.status !== "active") return -1;
        if (a.status !== "active" && b.status === "active") return 1;
        return parseFloat(b.amount.toString()) - parseFloat(a.amount.toString());
      }),
    [subscriptions]
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-400 border-green-500/30";
      case "overdue":
        return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";
      case "discontinued":
        return "bg-red-500/10 text-red-400 border-red-500/30";
      case "cancelled":
        return "bg-gray-500/10 text-gray-300 border-gray-500/30";
      default:
        return "bg-white/10 text-white";
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] px-4 pb-12 pt-4 text-white sm:px-6 md:px-10 lg:px-14">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 md:gap-8">
        <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
          <SheetContent className="border-white/15 bg-[#121212] text-white">
            <SheetHeader>
              <SheetTitle className="text-white">Edit Subscription</SheetTitle>
            </SheetHeader>
            {editingSub && (
              <form onSubmit={handleUpdate} className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Name</Label>
                  <Input
                    value={editingSub.name}
                    onChange={(e) => setEditingSub({ ...editingSub, name: e.target.value })}
                    className="border-white/10 bg-[#0a0a0a] text-white"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Merchant Name (Pattern)</Label>
                  <Input
                    value={editingSub.merchant_name || ""}
                    onChange={(e) =>
                      setEditingSub({ ...editingSub, merchant_name: e.target.value })
                    }
                    className="border-white/10 bg-[#0a0a0a] text-white"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingSub.amount}
                    onChange={(e) =>
                      setEditingSub({ ...editingSub, amount: parseFloat(e.target.value) })
                    }
                    className="border-white/10 bg-[#0a0a0a] text-white"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Frequency</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-white/10 bg-[#0a0a0a] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                    value={editingSub.frequency}
                    onChange={(e) => setEditingSub({ ...editingSub, frequency: e.target.value })}
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-white/10 bg-[#0a0a0a] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                    value={editingSub.status}
                    onChange={(e) =>
                      setEditingSub({ ...editingSub, status: e.target.value as any })
                    }
                  >
                    <option value="active">Active</option>
                    <option value="overdue">Overdue</option>
                    <option value="discontinued">Discontinued</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <Button type="submit" className="mt-4">
                  Save Changes
                </Button>
              </form>
            )}
          </SheetContent>
        </Sheet>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Subscriptions</h1>
            <p className="mt-1 text-sm text-white/60 sm:text-base">
              Monitor recurring expenses, projected burn, and unusual patterns.
            </p>
          </div>
          <Button onClick={handleScan} disabled={scanning} className="w-full sm:w-auto">
            {scanning ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Scan for Subscriptions
          </Button>
        </div>

        <section className="space-y-3 rounded-2xl border border-white/10 bg-[#121212] p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
            <TrendingUp className="h-5 w-5 text-yellow-500" />
            Smart Insights
          </h2>
          {insights.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {insights.map((insight) => (
                <div
                  key={insight.id}
                  className="flex items-start gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 transition-colors hover:bg-yellow-500/10"
                >
                  <div className="rounded-lg bg-yellow-500/20 p-2 text-yellow-500">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-medium text-yellow-400">{insight.title}</h3>
                    <p className="mt-1 text-sm text-white/65">{insight.message}</p>
                    <div className="mt-2 w-fit rounded border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-300">
                      {insight.metric} vs usual
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-white/50">
              <CheckCircle2 className="h-5 w-5 text-green-500/60" />
              <div>
                <p className="font-medium text-white/80">No anomalies detected</p>
                <p className="text-sm">Your subscription costs appear stable.</p>
              </div>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="border-white/10 bg-[#121212]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/60">Monthly Burn Rate</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">${monthlyBurn.toFixed(2)}</div>
              <p className="mt-1 text-xs text-white/40">Estimated fixed monthly costs</p>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#121212]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/60">Yearly Projection</CardTitle>
              <CalendarDays className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">${yearlyBurn.toFixed(2)}</div>
              <p className="mt-1 text-xs text-white/40">Total annual recurring cost</p>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#121212]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/60">Active Subscriptions</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{activeSubs.length}</div>
              <p className="mt-1 text-xs text-white/40">
                {subscriptions.length - activeSubs.length} inactive or cancelled
              </p>
            </CardContent>
          </Card>
        </div>

        <div>
          {loading ? (
            <div className="flex justify-center rounded-2xl border border-white/10 bg-[#121212] p-12">
              <Loader2 className="h-8 w-8 animate-spin text-white/20" />
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 py-16 text-center">
              <p className="text-white/45">No subscriptions found.</p>
              <Button variant="link" onClick={handleScan} className="mt-2 text-blue-400">
                Run a scan to find them
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sortedSubscriptions.map((sub) => (
                <Card
                  key={sub.id}
                  className={cn(
                    "group border-white/10 bg-[#121212] transition-all hover:border-white/20",
                    sub.status !== "active" && "opacity-70"
                  )}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 text-lg font-bold text-white/80">
                          {sub.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="truncate text-base font-semibold text-white transition-colors group-hover:text-blue-400">
                            {sub.name}
                          </CardTitle>
                          <p className="truncate text-xs capitalize text-white/40">
                            {sub.frequency} • {sub.category_name || "Uncategorized"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingSub(sub);
                            setIsEditOpen(true);
                          }}
                          className="h-8 w-8 text-white/40 hover:bg-blue-500/10 hover:text-blue-500"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Are you sure you want to delete this subscription?")) {
                              handleDelete(sub.id);
                            }
                          }}
                          className="h-8 w-8 text-white/40 hover:bg-red-500/10 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="mb-3 text-2xl font-bold text-white">
                      ${parseFloat(sub.amount.toString()).toFixed(2)}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className={cn("capitalize border", getStatusColor(sub.status))}>
                        {sub.status}
                      </Badge>

                      {sub.next_due_date && sub.status === "active" && (
                        <div className="text-xs text-white/45">
                          Due {format(new Date(sub.next_due_date), "MMM d")}
                        </div>
                      )}
                      {sub.status === "discontinued" && (
                        <div className="flex items-center gap-1 text-xs text-red-500/60">
                          <Ban className="h-3 w-3" /> Discontinued
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
